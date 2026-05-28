import { Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  EnvironmentsModule,
  EnvironmentsService,
} from '@plys/libraries/common-nest/modules/environments';
import { GRPC_PACKAGES, HTTP_PROTO_PATH } from '@plys/libraries/proto';

import { NotificationsClientService } from './notifications-client.service';
import {
  NOTIFICATIONS_GRPC,
  NotificationsGrpcClient,
  resolveNotificationsProtoPath,
} from './notifications-grpc.client';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: NOTIFICATIONS_GRPC,
        imports: [EnvironmentsModule],
        inject: [EnvironmentsService],
        useFactory: (
          env: EnvironmentsService,
        ): {
          transport: Transport.GRPC;
          options: {
            package: string[];
            protoPath: string[];
            url: string;
          };
        } => ({
          transport: Transport.GRPC,
          options: {
            package: [GRPC_PACKAGES.COMMON, GRPC_PACKAGES.NOTIFICATIONS],
            protoPath: [HTTP_PROTO_PATH, resolveNotificationsProtoPath()],
            url: env.notificationsServiceGrpcUrl,
          },
        }),
      },
    ]),
  ],
  providers: [NotificationsGrpcClient, NotificationsClientService],
  exports: [NotificationsClientService],
})
export class NotificationsClientModule {}
