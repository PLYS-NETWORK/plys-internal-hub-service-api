import { NestFactory } from '@nestjs/core';
import {
  connectDomainGrpcMicroservice,
  startGrpcOnlyService,
} from '@plys/libraries/common-nest/grpc';
import { GRPC_PACKAGES, IDENTITY_PROTO_PATH } from '@plys/libraries/proto';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  connectDomainGrpcMicroservice(app, {
    grpcPortEnv: 'IDENTITY_GRPC_PORT',
    defaultPort: '5001',
    domainProtoPath: IDENTITY_PROTO_PATH,
    packages: [GRPC_PACKAGES.IDENTITY],
    protoDirName: 'identity/v1/identity.proto',
  });

  await startGrpcOnlyService(app, 'identity-service', 'IDENTITY_GRPC_PORT', '5001');
}

void bootstrap();
