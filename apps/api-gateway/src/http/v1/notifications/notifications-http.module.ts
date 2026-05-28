import { Module } from '@nestjs/common';

import { NotificationsClientsModule } from '@/clients/v1/notifications';

import { gatewayJwtAuthImports } from '../shared/gateway-http-auth.providers';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NOTIFICATIONS_HTTP_PROVIDERS } from './notifications-http.providers';

@Module({
  imports: [NotificationsClientsModule, ...gatewayJwtAuthImports],
  controllers: [NotificationsController],
  providers: [...NOTIFICATIONS_HTTP_PROVIDERS, NotificationsGateway],
})
export class NotificationsHttpModule {}
