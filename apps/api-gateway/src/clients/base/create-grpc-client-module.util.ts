import * as path from 'node:path';

import { DynamicModule } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  EnvironmentsModule,
  EnvironmentsService,
} from '@plys/libraries/common-nest/modules/environments';
import { DOMAIN_PROTO_PATHS, GRPC_PACKAGES } from '@plys/libraries/proto';

import { resolveProtoPaths } from './grpc-proto.util';

type DomainKey = keyof typeof DOMAIN_PROTO_PATHS;

const DOMAIN_PROTO_RELATIVE: Record<DomainKey, string[]> = {
  IDENTITY: ['common/v1/http.proto', 'identity/v1/identity.proto'],
  PROFILES: ['common/v1/http.proto', 'profiles/v1/profiles.proto'],
  PROJECTS: ['common/v1/http.proto', 'projects/v1/projects.proto'],
  FINANCE: ['common/v1/http.proto', 'finance/v1/finance.proto'],
  PLATFORM: ['common/v1/http.proto', 'platform/v1/platform.proto'],
};

export function createGrpcClientModuleOptions(
  domain: DomainKey,
  token: string,
  urlSelector: (env: EnvironmentsService) => string,
): DynamicModule {
  const protoPaths = DOMAIN_PROTO_PATHS[domain];
  const cwdFallback = DOMAIN_PROTO_RELATIVE[domain].map((relative) =>
    path.join(process.cwd(), 'packages/proto', relative),
  );

  return ClientsModule.registerAsync([
    {
      name: token,
      imports: [EnvironmentsModule],
      inject: [EnvironmentsService],
      useFactory: (env: EnvironmentsService) => ({
        transport: Transport.GRPC,
        options: {
          package: [GRPC_PACKAGES.COMMON, GRPC_PACKAGES[domain]],
          protoPath: [...resolveProtoPaths([protoPaths, cwdFallback])],
          url: urlSelector(env),
          loader: {
            includeDirs: [path.join(process.cwd(), 'packages/proto')],
          },
        },
      }),
    },
  ]);
}
