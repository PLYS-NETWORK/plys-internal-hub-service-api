import {
  connectDomainGrpcMicroservice,
  createGrpcHostApplication,
  startGrpcOnlyService,
} from '@plys/libraries/common-nest/grpc';
import { GRPC_PACKAGES, NOTIFICATIONS_PROTO_PATH } from '@plys/libraries/proto';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await createGrpcHostApplication(AppModule, { bufferLogs: true });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  connectDomainGrpcMicroservice(app, {
    grpcPortEnv: 'NOTIFICATIONS_GRPC_PORT',
    defaultPort: '5007',
    domainProtoPath: NOTIFICATIONS_PROTO_PATH,
    packages: [GRPC_PACKAGES.NOTIFICATIONS],
    protoDirName: 'notifications/v1/notifications.proto',
  });

  await startGrpcOnlyService(app, 'notifications-service', 'NOTIFICATIONS_GRPC_PORT', '5007');
}

void bootstrap();
