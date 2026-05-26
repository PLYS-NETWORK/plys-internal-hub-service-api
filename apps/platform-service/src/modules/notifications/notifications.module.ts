import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';

import { SKILL_MATCH_NOTIFICATION_QUEUE } from './queues/skill-match-notification.constants';
import { SkillMatchNotificationProcessor } from './queues/skill-match-notification.processor';
import { NotificationDispatcherService } from './services/notification-dispatcher.service';
import { NotificationEventHandlerService } from './services/notification-event-handler.service';
import { NotificationsService } from './services/notifications.service';

@Module({
  imports: [
    UnitOfWorkModule,
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
    NotificationEventHandlerService,
    SkillMatchNotificationProcessor,
  ],
  exports: [NotificationDispatcherService],
})
export class NotificationsModule {}
