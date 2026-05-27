import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationRealtimeModule } from '@plys/libraries/common-nest/modules/notifications-realtime';
import { RedisModule } from '@plys/libraries/common-nest/modules/redis';
import { RequestContextModule } from '@plys/libraries/common-nest/modules/request-context';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';

import { SKILL_MATCH_NOTIFICATION_QUEUE } from './queues/skill-match-notification.constants';
import { SkillMatchNotificationProcessor } from './queues/skill-match-notification.processor';
import { NotificationAdminEventHandlerService } from './services/notification-admin-event-handler.service';
import { NotificationBusinessEventHandlerService } from './services/notification-business-event-handler.service';
import { NotificationConsultantEventHandlerService } from './services/notification-consultant-event-handler.service';
import { NotificationDispatcherService } from './services/notification-dispatcher.service';
import { NotificationEventHandlerService } from './services/notification-event-handler.service';
import { NotificationEventSharedService } from './services/notification-event-shared.service';
import { NotificationsService } from './services/notifications.service';

@Module({
  imports: [
    UnitOfWorkModule,
    RedisModule,
    RequestContextModule,
    NotificationRealtimeModule,
    // Standalone JwtModule registration (matches AuthModule's pattern) — secret
    // and claim options are passed per-call inside the gateway. Registering here
    // (instead of importing AuthModule) avoids a circular dependency once
    // AuthModule imports NotificationsModule for the password-change trigger.
    JwtModule.register({}),
    BullModule.registerQueue({ name: SKILL_MATCH_NOTIFICATION_QUEUE }),
  ],
  controllers: [],
  providers: [
    NotificationsService,
    NotificationDispatcherService,
    NotificationEventSharedService,
    NotificationAdminEventHandlerService,
    NotificationBusinessEventHandlerService,
    NotificationConsultantEventHandlerService,
    NotificationEventHandlerService,
    SkillMatchNotificationProcessor,
  ],
  exports: [NotificationDispatcherService, NotificationsService],
})
export class NotificationsModule {}
