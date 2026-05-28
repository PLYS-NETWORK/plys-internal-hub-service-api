import {
  connectDomainGrpcMicroservice,
  createGrpcHostApplication,
  startGrpcOnlyService,
} from '@plys/libraries/common-nest/grpc';
import { AIPROVIDER_PROTO_PATH, GRPC_PACKAGES } from '@plys/libraries/proto';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await createGrpcHostApplication(AppModule, { bufferLogs: true });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  connectDomainGrpcMicroservice(app, {
    grpcPortEnv: 'AI_PROVIDER_GRPC_PORT',
    defaultPort: '5009',
    domainProtoPath: AIPROVIDER_PROTO_PATH,
    packages: [GRPC_PACKAGES.AIPROVIDER],
    protoDirName: 'aiprovider/v1/aiprovider.proto',
  });

  await startGrpcOnlyService(app, 'ai-provider-service', 'AI_PROVIDER_GRPC_PORT', '5009');
}

void bootstrap();
