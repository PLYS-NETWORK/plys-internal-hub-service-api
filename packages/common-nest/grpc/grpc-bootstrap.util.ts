import * as fs from 'node:fs';
import * as path from 'node:path';

import { Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { GRPC_PACKAGES, HEALTH_PROTO_PATH } from '@plys/libraries/proto';

export interface IGrpcServiceBootstrapOptions {
  grpcPortEnv: string;
  defaultPort: string;
  domainProtoPath: string;
  packages: string[];
  protoDirName: string;
}

export interface IGrpcBootstrapApplication {
  connectMicroservice(options: MicroserviceOptions): unknown;
  startAllMicroservices(): Promise<unknown>;
  init(): Promise<unknown>;
}

/** Nest 11 requires an HTTP platform adapter even for gRPC-only services (no HTTP listen). */
export async function createGrpcHostApplication(
  module: Type<unknown>,
  options?: { bufferLogs?: boolean },
): Promise<NestFastifyApplication> {
  return NestFactory.create(module, new FastifyAdapter(), {
    bufferLogs: options?.bufferLogs ?? false,
  });
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
  const domainProto = resolveProtoPath([
    path.join(__dirname, options.protoDirName),
    options.domainProtoPath,
    path.join(process.cwd(), 'packages/proto', options.protoDirName),
  ]);

  app.connectMicroservice({
    transport: Transport.GRPC,
    options: {
      package: [GRPC_PACKAGES.HEALTH, GRPC_PACKAGES.COMMON, ...options.packages],
      // Domain protos import common/v1/http.proto — do not list http.proto separately (duplicate symbols).
      protoPath: [healthProto, domainProto],
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
