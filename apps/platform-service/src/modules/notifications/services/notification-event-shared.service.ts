import { Injectable } from '@nestjs/common';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';

import { NotificationType } from '../enums/notification-type.enum';
import { NotificationMetadataMap } from '../types/notification-metadata.types';
import { NotificationDispatcherService } from './notification-dispatcher.service';

@Injectable()
export class NotificationEventSharedService {
  private readonly logger: AppLogger;

  public get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly dispatcher: NotificationDispatcherService,
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(NotificationEventSharedService.name, requestContext);
  }

  public async resolveConsultantName(userId: string): Promise<string> {
    const profile = await this.uow.consultantProfiles.findByUserId(userId);
    if (profile?.fullName) return profile.fullName;
    const user = await this.uow.users.findById(userId);
    return user?.email ?? '';
  }

  public async resolveBusinessName(businessId: string): Promise<string> {
    const profile = await this.uow.businessProfiles.findOne({ where: { id: businessId } });
    return profile?.companyName ?? '';
  }

  /**
   * Queries all active admin user IDs and dispatches the given notification
   * concurrently using Promise.allSettled — individual dispatch failures do not
   * abort the fan-out for remaining admins.
   */
  public async dispatchToAllAdmins<T extends NotificationType>(
    type: T,
    metadata: NotificationMetadataMap[T],
    actorId: string | null = null,
  ): Promise<void> {
    try {
      const adminUserIds = await this.uow.users.findActiveAdminUserIds();
      if (adminUserIds.length === 0) {
        this.logger.warn(`[${this.rid}] dispatchToAllAdmins — no active admins | type: ${type}`);
        return;
      }
      await Promise.allSettled(
        adminUserIds.map((userId) => this.dispatcher.dispatch({ userId, type, metadata, actorId })),
      );
      this.logger.log(
        `[${this.rid}] dispatchToAllAdmins — complete | type: ${type} | count: ${adminUserIds.length}`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `[${this.rid}] dispatchToAllAdmins — failed | type: ${type} | error: ${String(err)}`,
      );
    }
  }
}
