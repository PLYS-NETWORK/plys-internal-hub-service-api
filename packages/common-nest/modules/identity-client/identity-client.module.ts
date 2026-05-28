/* eslint-disable @typescript-eslint/explicit-function-return-type */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  EnvironmentsModule,
  EnvironmentsService,
} from '@plys/libraries/common-nest/modules/environments';
import {
  getProtoLoaderIncludeDirs,
  GRPC_PACKAGES,
  IDENTITY_PROTO_PATH,
} from '@plys/libraries/proto';

import { IdentitySessionClient } from './identity-session.client';

function resolveIdentityProtoPath(): string {
  const candidates = [
    IDENTITY_PROTO_PATH,
    path.join(process.cwd(), 'packages/proto/identity/v1/identity.proto'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'IDENTITY_GRPC',
        imports: [EnvironmentsModule],
        inject: [EnvironmentsService],
        useFactory: (env: EnvironmentsService) => ({
          transport: Transport.GRPC,
          options: {
            package: GRPC_PACKAGES.IDENTITY,
            protoPath: resolveIdentityProtoPath(),
            url: env.identityServiceGrpcUrl,
            loader: {
              includeDirs: getProtoLoaderIncludeDirs(),
            },
          },
        }),
      },
    ]),
  ],
  providers: [IdentitySessionClient],
  exports: [IdentitySessionClient],
})
export class IdentityClientModule {}
