import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationDispatcherService } from './services/notification-dispatcher.service';
import { NotificationsService } from './services/notifications.service';

@Module({
  imports: [
    UnitOfWorkModule,
    // Standalone JwtModule registration (matches AuthModule's pattern) — secret
    // and claim options are passed per-call inside the gateway. Registering here
    // (instead of importing AuthModule) avoids a circular dependency once
    // AuthModule imports NotificationsModule for the password-change trigger.
    JwtModule.register({}),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationDispatcherService, NotificationsGateway],
  exports: [NotificationDispatcherService],
})
export class NotificationsModule {}
