import {
  connectDomainGrpcMicroservice,
  createGrpcHostApplication,
  startGrpcOnlyService,
} from '@plys/libraries/common-nest/grpc';
import { CONSULTANT_PROTO_PATH, GRPC_PACKAGES } from '@plys/libraries/proto';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await createGrpcHostApplication(AppModule, { bufferLogs: true });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  connectDomainGrpcMicroservice(app, {
    grpcPortEnv: 'CONSULTANT_GRPC_PORT',
    defaultPort: '5003',
    domainProtoPath: CONSULTANT_PROTO_PATH,
    packages: [GRPC_PACKAGES.CONSULTANT],
    protoDirName: 'consultant/v1/consultant.proto',
  });

  await startGrpcOnlyService(app, 'consultant-service', 'CONSULTANT_GRPC_PORT', '5003');
}

void bootstrap();
