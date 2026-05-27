import { Global, Module } from '@nestjs/common';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { IdentitySessionClient } from '@plys/libraries/common-nest/modules/identity-client';

import { createGrpcClientModuleOptions } from '../base/create-grpc-client-module.util';
import { GatewayGrpcModule } from '../base/grpc-gateway.module';
import {
  IDENTITY_GRPC,
  IdentityAdminAllowedEmailsClient,
  IdentityAdminAuthClient,
  IdentityAuthClient,
  IdentityUsersClient,
} from './identity-grpc.clients';

@Global()
@Module({
  imports: [
    GatewayGrpcModule,
    createGrpcClientModuleOptions(
      'IDENTITY',
      IDENTITY_GRPC,
      (env: EnvironmentsService) => env.identityServiceGrpcUrl,
    ),
  ],
  providers: [
    IdentitySessionClient,
    IdentityAuthClient,
    IdentityAdminAuthClient,
    IdentityAdminAllowedEmailsClient,
    IdentityUsersClient,
  ],
  exports: [
    IdentitySessionClient,
    IdentityAuthClient,
    IdentityAdminAuthClient,
    IdentityAdminAllowedEmailsClient,
    IdentityUsersClient,
  ],
})
export class IdentityClientsModule {}
