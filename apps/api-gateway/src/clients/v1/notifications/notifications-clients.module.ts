import { Global, Module } from '@nestjs/common';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';

import { createGrpcClientModuleOptions } from '../../base/create-grpc-client-module.util';
import { GatewayGrpcModule } from '../../base/grpc-gateway.module';
import { NOTIFICATIONS_GRPC, NotificationsClient } from './notifications-grpc.clients';

@Global()
@Module({
  imports: [
    GatewayGrpcModule,
    createGrpcClientModuleOptions(
      'NOTIFICATIONS',
      NOTIFICATIONS_GRPC,
      (env: EnvironmentsService) => env.notificationsServiceGrpcUrl,
    ),
  ],
  providers: [NotificationsClient],
  exports: [NotificationsClient],
})
export class NotificationsClientsModule {}
