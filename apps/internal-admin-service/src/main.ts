import {
  connectDomainGrpcMicroservice,
  createGrpcHostApplication,
  startGrpcOnlyService,
} from '@plys/libraries/common-nest/grpc';
import { GRPC_PACKAGES, INTERNAL_ADMIN_PROTO_PATH } from '@plys/libraries/proto';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await createGrpcHostApplication(AppModule, { bufferLogs: true });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  connectDomainGrpcMicroservice(app, {
    grpcPortEnv: 'INTERNAL_ADMIN_GRPC_PORT',
    defaultPort: '5004',
    domainProtoPath: INTERNAL_ADMIN_PROTO_PATH,
    packages: [GRPC_PACKAGES.INTERNAL_ADMIN],
    protoDirName: 'internal-admin/v1/internal-admin.proto',
  });

  await startGrpcOnlyService(app, 'internal-admin-service', 'INTERNAL_ADMIN_GRPC_PORT', '5004');
}

void bootstrap();
