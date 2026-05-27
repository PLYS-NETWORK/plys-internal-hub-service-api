import { Injectable } from '@nestjs/common';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { NotificationRealtimeEmitterService } from '@plys/libraries/common-nest/modules/notifications-realtime';
import { NOTIFICATION_UNREAD_COUNT_KEY_PREFIX } from '@plys/libraries/common-nest/modules/notifications-realtime/notification-realtime.constants';
import { RedisService } from '@plys/libraries/common-nest/modules/redis/redis.service';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { Notification } from '@plys/libraries/database/entities';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';
import { plainToInstance } from 'class-transformer';
import { I18nService } from 'nestjs-i18n';

import {
  NOTIFICATION_TYPE_CONFIG,
  NotificationBaseUrlKey,
} from '../config/notification-type-config';
import { NotificationResponseDto } from '../dto/responses';
import { NotificationType } from '../enums/notification-type.enum';
import {
  IDispatchInput,
  INotificationDispatcherService,
} from '../interfaces/notification-dispatcher-service.interface';
import { NotificationMetadataMap } from '../types/notification-metadata.types';

const UNREAD_COUNT_TTL_SECONDS = 60 * 60 * 24; // 24h

@Injectable()
export class NotificationDispatcherService implements INotificationDispatcherService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly redis: RedisService,
    private readonly realtimeEmitter: NotificationRealtimeEmitterService,
    private readonly env: EnvironmentsService,
    private readonly i18n: I18nService,
  ) {
    this.logger = new AppLogger(NotificationDispatcherService.name, requestContext);
  }

  /** @inheritdoc */
  public async dispatch<T extends NotificationType>(
    input: IDispatchInput<T>,
  ): Promise<string | null> {
    const lang = this.requestContext.lang ?? 'en';
    const config = NOTIFICATION_TYPE_CONFIG[input.type] as (typeof NOTIFICATION_TYPE_CONFIG)[T];

    try {
      const businessId = await this.resolveBusinessId(input.userId);
      const titleKey =
        typeof config.titleKey === 'function' ? config.titleKey(input.metadata) : config.titleKey;
      const bodyKey =
        typeof config.bodyKey === 'function' ? config.bodyKey(input.metadata) : config.bodyKey;
      const title = await this.translate(titleKey, lang, undefined);
      const body = await this.translate(
        bodyKey,
        lang,
        config.bodyArgs ? config.bodyArgs(input.metadata) : undefined,
      );

      const entityType = config.entityType;
      const entityId = config.getEntityId(input.metadata, input.userId);
      const baseUrl = this.resolveBaseUrl(config.baseUrlKey);
      const redirectUrl =
        input.redirectUrlOverride ?? config.getRedirectUrl(input.metadata, baseUrl, businessId);

      const saved = await this.uow.withTransaction(async (uow) => {
        const row = uow.notifications.create({
          userId: input.userId,
          type: input.type,
          title,
          body,
          metadata: input.metadata as unknown as Record<string, unknown>,
          entityType,
          entityId,
          redirectUrl,
          actorId: input.actorId ?? null,
          isRead: false,
          readAt: null,
        }) as Notification;
        return uow.notifications.save(row);
      });

      const dto = plainToInstance(
        NotificationResponseDto,
        this.toPlainResponse(saved, input.metadata),
        { excludeExtraneousValues: true },
      );

      // Live push — best-effort; the row in Postgres is the source of truth.
      try {
        this.realtimeEmitter.emitToUser(input.userId, dto);
      } catch (publishErr: unknown) {
        const msg = publishErr instanceof Error ? publishErr.message : String(publishErr);
        this.logger.warn(
          `dispatch — publish failed but row persisted | id: ${saved.id} | userId: ${input.userId} | error: ${msg}`,
        );
      }

      // Best-effort unread-count cache. Materialised lazily on first read so we
      // don't accidentally show "1" on a fresh user where no count was cached yet.
      void this.bumpUnreadCount(input.userId).catch(() => undefined);

      this.logger.log(
        `dispatch — complete | type: ${input.type} | userId: ${input.userId} | notificationId: ${saved.id}`,
      );
      return saved.id;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `dispatch — failed | type: ${input.type} | userId: ${input.userId} | error: ${message}`,
      );
      return null;
    }
  }

  private resolveBaseUrl(key: NotificationBaseUrlKey | undefined): string {
    if (key === 'internalHubUrl') return this.env.internalHubUrl;
    if (key === 'lonaosUrl') return this.env.lonaosUrl;
    return this.env.ployosUrl;
  }

  /**
   * Resolves the recipient's `businessId` from their `userId`. Returns `null`
   * when no business profile is attached (e.g. the user is admin or consultant)
   * — the redirect URL falls back to a tenant-less path in that case.
   */
  private async resolveBusinessId(userId: string): Promise<string | null> {
    try {
      const profile = await this.uow.businessProfiles.findByUserId(userId);
      return profile?.id ?? null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`resolveBusinessId — lookup failed | userId: ${userId} | error: ${msg}`);
      return null;
    }
  }

  /**
   * Increments the unread-count cache only when the key already exists. This
   * preserves the lazy-materialisation contract so the first GET /me/unread-count
   * for a user always issues a definitive COUNT(*) before caching the result.
   */
  private async bumpUnreadCount(userId: string): Promise<void> {
    const key = NOTIFICATION_UNREAD_COUNT_KEY_PREFIX + userId;
    if (await this.redis.exists(key)) {
      await this.redis.incr(key);
      await this.redis.expire(key, UNREAD_COUNT_TTL_SECONDS);
    }
  }

  private async translate(
    key: string,
    lang: string,
    args: Record<string, string | number> | undefined,
  ): Promise<string> {
    try {
      const translated = (await this.i18n.translate(key, { lang, args })) as string;
      return typeof translated === 'string' ? translated : key;
    } catch {
      return key;
    }
  }

  private toPlainResponse(
    row: Notification,
    metadata: NotificationMetadataMap[NotificationType],
  ): Record<string, unknown> {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      metadata: metadata as unknown as Record<string, unknown>,
      entity_type: row.entityType,
      entity_id: row.entityId,
      redirect_url: row.redirectUrl,
      is_read: row.isRead,
      read_at: row.readAt ? row.readAt.toISOString() : null,
      created_at: row.createdAt.toISOString(),
      actor_id: row.actorId,
    };
  }
}
