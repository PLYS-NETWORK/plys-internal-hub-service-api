/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  EnvironmentsModule,
  EnvironmentsService,
} from '@plys/libraries/common-nest/modules/environments';
import {
  getProtoLoaderIncludeDirs,
  GRPC_PACKAGES,
  resolveNotificationsProtoPath,
} from '@plys/libraries/proto';

import { NotificationsClientService } from './notifications-client.service';
import { NOTIFICATIONS_GRPC, NotificationsGrpcClient } from './notifications-grpc.client';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: NOTIFICATIONS_GRPC,
        imports: [EnvironmentsModule],
        inject: [EnvironmentsService],
        useFactory: (env: EnvironmentsService) => ({
          transport: Transport.GRPC,
          options: {
            package: [GRPC_PACKAGES.COMMON, GRPC_PACKAGES.NOTIFICATIONS],
            protoPath: [resolveNotificationsProtoPath()],
            url: env.notificationsServiceGrpcUrl,
            loader: {
              includeDirs: getProtoLoaderIncludeDirs(),
            },
          },
        }),
      },
    ]),
  ],
  providers: [NotificationsGrpcClient, NotificationsClientService],
  exports: [NotificationsClientService],
})
export class NotificationsClientModule {}
