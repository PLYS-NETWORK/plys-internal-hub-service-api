import {
  connectDomainGrpcMicroservice,
  createGrpcHostApplication,
  startGrpcOnlyService,
} from '@plys/libraries/common-nest/grpc';
import { GRPC_PACKAGES, PLATFORM_PROTO_PATH } from '@plys/libraries/proto';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await createGrpcHostApplication(AppModule, { bufferLogs: true });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  connectDomainGrpcMicroservice(app, {
    grpcPortEnv: 'PLATFORM_GRPC_PORT',
    defaultPort: '5008',
    domainProtoPath: PLATFORM_PROTO_PATH,
    packages: [GRPC_PACKAGES.PLATFORM],
    protoDirName: 'platform/v1/platform.proto',
  });

  await startGrpcOnlyService(app, 'platform-service', 'PLATFORM_GRPC_PORT', '5008');
}

void bootstrap();
