import * as path from 'node:path';

import { DynamicModule } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  EnvironmentsModule,
  EnvironmentsService,
} from '@plys/libraries/common-nest/modules/environments';
import {
  DOMAIN_PROTO_PATHS,
  getProtoLoaderIncludeDirs,
  GRPC_PACKAGES,
} from '@plys/libraries/proto';

import { resolveProtoPaths } from './grpc-proto.util';

const GRPC_CLIENT_CHANNEL_OPTIONS = {
  'grpc.initial_reconnect_backoff_ms': 500,
  'grpc.max_reconnect_backoff_ms': 5_000,
  'grpc.keepalive_time_ms': 30_000,
  'grpc.keepalive_timeout_ms': 10_000,
  'grpc.service_config': JSON.stringify({
    methodConfig: [
      {
        name: [{}],
        retryPolicy: {
          maxAttempts: 5,
          initialBackoff: '0.5s',
          maxBackoff: '5s',
          backoffMultiplier: 2,
          retryableStatusCodes: ['UNAVAILABLE'],
        },
      },
    ],
  }),
};

type DomainKey = keyof typeof DOMAIN_PROTO_PATHS;

const DOMAIN_PROTO_RELATIVE: Record<DomainKey, string[]> = {
  IDENTITY: ['identity/v1/identity.proto'],
  PROFILES: ['profiles/v1/profiles.proto'],
  PROJECTS: ['projects/v1/projects.proto'],
  FINANCE: ['finance/v1/finance.proto'],
  PLATFORM: ['platform/v1/platform.proto'],
  NOTIFICATIONS: ['notifications/v1/notifications.proto'],
  AIPROVIDER: ['aiprovider/v1/aiprovider.proto'],
  BUSINESS: ['business/v1/business.proto'],
  CONSULTANT: ['consultant/v1/consultant.proto'],
  INTERNAL_ADMIN: ['internal-admin/v1/internal-admin.proto'],
  INTERNAL_TASK_REVIEWER: ['internal-task-reviewer/v1/internal-task-reviewer.proto'],
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
          channelOptions: GRPC_CLIENT_CHANNEL_OPTIONS,
          loader: {
            includeDirs: getProtoLoaderIncludeDirs(),
          },
        },
      }),
    },
  ]);
}
