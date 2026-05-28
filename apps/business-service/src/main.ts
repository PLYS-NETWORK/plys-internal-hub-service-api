import {
  connectDomainGrpcMicroservice,
  createGrpcHostApplication,
  startGrpcOnlyService,
} from '@plys/libraries/common-nest/grpc';
import { BUSINESS_PROTO_PATH, GRPC_PACKAGES } from '@plys/libraries/proto';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await createGrpcHostApplication(AppModule, { bufferLogs: true });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  connectDomainGrpcMicroservice(app, {
    grpcPortEnv: 'BUSINESS_GRPC_PORT',
    defaultPort: '5002',
    domainProtoPath: BUSINESS_PROTO_PATH,
    packages: [GRPC_PACKAGES.BUSINESS],
    protoDirName: 'business/v1/business.proto',
  });

  await startGrpcOnlyService(app, 'business-service', 'BUSINESS_GRPC_PORT', '5002');
}

void bootstrap();
