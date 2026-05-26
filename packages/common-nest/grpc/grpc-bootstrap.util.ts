import * as fs from 'node:fs';
import * as path from 'node:path';

import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { GRPC_PACKAGES, HEALTH_PROTO_PATH, HTTP_PROTO_PATH } from '@plys/libraries/proto';

export interface IGrpcServiceBootstrapOptions {
  grpcPortEnv: string;
  defaultPort: string;
  domainProtoPath: string;
  packages: string[];
  protoDirName: string;
}

interface IGrpcBootstrapApplication {
  connectMicroservice(options: MicroserviceOptions): unknown;
  startAllMicroservices(): Promise<unknown>;
  init(): Promise<unknown>;
}

export function resolveProtoPath(candidates: string[]): string {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}

export function connectDomainGrpcMicroservice(
  app: IGrpcBootstrapApplication,
  options: IGrpcServiceBootstrapOptions,
): void {
  const grpcPort = process.env[options.grpcPortEnv] ?? options.defaultPort;

  const healthProto = resolveProtoPath([
    path.join(__dirname, 'common/v1/health.proto'),
    HEALTH_PROTO_PATH,
    path.join(process.cwd(), 'packages/proto/common/v1/health.proto'),
  ]);
  const httpProto = resolveProtoPath([
    path.join(__dirname, 'common/v1/http.proto'),
    HTTP_PROTO_PATH,
    path.join(process.cwd(), 'packages/proto/common/v1/http.proto'),
  ]);
  const domainProto = resolveProtoPath([
    path.join(__dirname, options.protoDirName),
    options.domainProtoPath,
    path.join(process.cwd(), 'packages/proto', options.protoDirName),
  ]);

  app.connectMicroservice({
    transport: Transport.GRPC,
    options: {
      package: [GRPC_PACKAGES.HEALTH, GRPC_PACKAGES.COMMON, ...options.packages],
      protoPath: [healthProto, httpProto, domainProto],
      url: `0.0.0.0:${grpcPort}`,
      loader: {
        includeDirs: [path.dirname(healthProto), path.join(process.cwd(), 'packages/proto')],
      },
    },
  });
}

export async function startGrpcOnlyService(
  app: IGrpcBootstrapApplication,
  serviceLabel: string,
  grpcPortEnv: string,
  defaultPort: string,
): Promise<void> {
  await app.startAllMicroservices();
  await app.init();
  const grpcPort = process.env[grpcPortEnv] ?? defaultPort;
  // eslint-disable-next-line no-console
  console.log(`${serviceLabel} gRPC :${grpcPort}`);
}
