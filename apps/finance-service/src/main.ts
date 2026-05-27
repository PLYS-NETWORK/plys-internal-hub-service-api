import { NestFactory } from '@nestjs/core';
import {
  connectDomainGrpcMicroservice,
  startGrpcOnlyService,
} from '@plys/libraries/common-nest/grpc';
import { FINANCE_PROTO_PATH, GRPC_PACKAGES } from '@plys/libraries/proto';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  connectDomainGrpcMicroservice(app, {
    grpcPortEnv: 'FINANCE_GRPC_PORT',
    defaultPort: '5004',
    domainProtoPath: FINANCE_PROTO_PATH,
    packages: [GRPC_PACKAGES.FINANCE],
    protoDirName: 'finance/v1/finance.proto',
  });

  await startGrpcOnlyService(app, 'finance-service', 'FINANCE_GRPC_PORT', '5004');
}

void bootstrap();
