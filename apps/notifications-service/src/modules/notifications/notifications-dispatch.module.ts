import { Module } from '@nestjs/common';
import { I18nModule } from '@plys/libraries/common-nest/modules/i18n';
import { NotificationRealtimeModule } from '@plys/libraries/common-nest/modules/notifications-realtime';
import { RedisModule } from '@plys/libraries/common-nest/modules/redis';
import { RequestContextModule } from '@plys/libraries/common-nest/modules/request-context';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';

import { NotificationDispatcherService } from './services/notification-dispatcher.service';

/** Lean module for services that only dispatch notifications (no Bull queues / event handlers). */
@Module({
  imports: [
    UnitOfWorkModule,
    RedisModule,
    RequestContextModule,
    NotificationRealtimeModule,
    I18nModule,
  ],
  providers: [NotificationDispatcherService],
  exports: [NotificationDispatcherService],
})
export class NotificationsDispatchModule {}
