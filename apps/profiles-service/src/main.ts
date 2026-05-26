import { NestFactory } from '@nestjs/core';
import {
  connectDomainGrpcMicroservice,
  startGrpcOnlyService,
} from '@plys/libraries/common-nest/grpc';
import { GRPC_PACKAGES, PROFILES_PROTO_PATH } from '@plys/libraries/proto';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  connectDomainGrpcMicroservice(app, {
    grpcPortEnv: 'PROFILES_GRPC_PORT',
    defaultPort: '5002',
    domainProtoPath: PROFILES_PROTO_PATH,
    packages: [GRPC_PACKAGES.PROFILES],
    protoDirName: 'profiles/v1/profiles.proto',
  });

  await startGrpcOnlyService(app, 'profiles-service', 'PROFILES_GRPC_PORT', '5002');
}

void bootstrap();
