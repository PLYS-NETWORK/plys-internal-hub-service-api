import { HttpStatus, Injectable } from '@nestjs/common';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RedisService } from '@plys/libraries/common-nest/modules/redis/redis.service';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { Notification } from '@plys/libraries/database/entities';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { ERROR_CODES } from '../../../errors/error-codes';
import { ListNotificationsDto } from '../dto/requests';
import {
  MarkAllReadResponseDto,
  NotificationCursorPageDto,
  NotificationResponseDto,
  UnreadCountResponseDto,
} from '../dto/responses';
import { INotificationsService } from '../interfaces/notifications-service.interface';

const UNREAD_COUNT_KEY_PREFIX = 'notif:unread:';
const UNREAD_COUNT_TTL_SECONDS = 60 * 60 * 24; // 24h

interface ICursorPayload {
  createdAt: string;
  id: string;
}

@Injectable()
export class NotificationsService implements INotificationsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly redis: RedisService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(NotificationsService.name, requestContext);
  }

  /** @inheritdoc */
  public async listMine(dto: ListNotificationsDto): Promise<NotificationCursorPageDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(
      `listMine — start | userId: ${userId}, take: ${dto.take}, unread: ${dto.unread ?? false}`,
    );
    const cursor = this.decodeCursor(dto.cursor);
    const rows = await this.uow.notifications.listByUserCursor({
      userId,
      cursor: cursor ? { createdAt: new Date(cursor.createdAt), id: cursor.id } : undefined,
      take: dto.take,
      unreadOnly: dto.unread === true,
    });

    const hasMore = rows.length > dto.take;
    const items = hasMore ? rows.slice(0, dto.take) : rows;
    const last = items.length > 0 ? items[items.length - 1] : null;
    const nextCursor =
      hasMore && last
        ? this.encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
        : null;

    const result: NotificationCursorPageDto = {
      data: items.map((row) => this.toResponseDto(row)),
      next_cursor: nextCursor,
      has_more: hasMore,
    };
    this.logger.log(`listMine — complete | userId: ${userId}, returned: ${items.length}`);
    return result;
  }

  /** @inheritdoc */
  public async getUnreadCount(): Promise<UnreadCountResponseDto> {
    const userId = this.requestContext.userId!;
    const key = UNREAD_COUNT_KEY_PREFIX + userId;

    const cached = await this.tryReadCachedCount(key);
    if (cached !== null) {
      return { unread_count: cached };
    }

    const count = await this.uow.notifications.countUnreadByUserId(userId);
    void this.cacheUnreadCount(key, count).catch(() => undefined);
    return { unread_count: count };
  }

  /** @inheritdoc */
  public async markRead(notificationId: string): Promise<NotificationResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`markRead — start | userId: ${userId}, notificationId: ${notificationId}`);
    const transitioned = await this.uow.notifications.markRead(userId, notificationId);

    const row = await this.uow.notifications.findOne({
      where: { id: notificationId, userId },
    });
    if (!row) {
      this.logger.warn(
        `markRead — not found | userId: ${userId}, notificationId: ${notificationId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.notification.not_found',
        errorCode: ERROR_CODES.NOTIFICATION_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    if (transitioned) {
      void this.decrementUnreadCount(userId).catch(() => undefined);
    }
    return this.toResponseDto(row);
  }

  /** @inheritdoc */
  public async markAllRead(): Promise<MarkAllReadResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`markAllRead — start | userId: ${userId}`);
    const updated = await this.uow.notifications.markAllRead(userId);
    if (updated > 0) {
      void this.invalidateUnreadCount(userId).catch(() => undefined);
    }
    this.logger.log(`markAllRead — complete | userId: ${userId}, updated: ${updated}`);
    return { updated_count: updated };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private encodeCursor(payload: ICursorPayload): string {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  private decodeCursor(cursor: string | undefined): ICursorPayload | null {
    if (!cursor) {
      return null;
    }
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
      const parsed = JSON.parse(decoded) as ICursorPayload;
      if (typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') {
        return null;
      }
      return parsed;
    } catch {
      // Malformed cursor — treat as no cursor and start from page 1 rather than
      // surfacing a 422 the FE cannot recover from after a server redeploy.
      return null;
    }
  }

  private toResponseDto(row: Notification): NotificationResponseDto {
    return plainToInstance(
      NotificationResponseDto,
      {
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        metadata: row.metadata,
        entity_type: row.entityType,
        entity_id: row.entityId,
        redirect_url: row.redirectUrl,
        is_read: row.isRead,
        read_at: row.readAt ? row.readAt.toISOString() : null,
        created_at: row.createdAt.toISOString(),
        actor_id: row.actorId,
      },
      { excludeExtraneousValues: true },
    );
  }

  private async tryReadCachedCount(key: string): Promise<number | null> {
    try {
      const value = await this.redis.get(key);
      if (value === null) {
        return null;
      }
      const n = parseInt(value, 10);
      return Number.isFinite(n) && n >= 0 ? n : null;
    } catch {
      return null;
    }
  }

  private async cacheUnreadCount(key: string, count: number): Promise<void> {
    await this.redis.set(key, String(count), UNREAD_COUNT_TTL_SECONDS);
  }

  private async decrementUnreadCount(userId: string): Promise<void> {
    const key = UNREAD_COUNT_KEY_PREFIX + userId;
    if (!(await this.redis.exists(key))) {
      return;
    }
    // ioredis lacks a single-call DECRBY-with-floor; do incrBy(-1) and clamp on overshoot.
    const next = await this.redis.incrBy(key, -1);
    if (next < 0) {
      await this.redis.set(key, '0', UNREAD_COUNT_TTL_SECONDS);
    } else {
      await this.redis.expire(key, UNREAD_COUNT_TTL_SECONDS);
    }
  }

  private async invalidateUnreadCount(userId: string): Promise<void> {
    await this.redis.del(UNREAD_COUNT_KEY_PREFIX + userId);
  }
}
