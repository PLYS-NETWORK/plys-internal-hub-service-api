import {
  connectDomainGrpcMicroservice,
  createGrpcHostApplication,
  startGrpcOnlyService,
} from '@plys/libraries/common-nest/grpc';
import { GRPC_PACKAGES, PROJECTS_PROTO_PATH } from '@plys/libraries/proto';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await createGrpcHostApplication(AppModule, { bufferLogs: true });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  connectDomainGrpcMicroservice(app, {
    grpcPortEnv: 'PROJECTS_GRPC_PORT',
    defaultPort: '5003',
    domainProtoPath: PROJECTS_PROTO_PATH,
    packages: [GRPC_PACKAGES.PROJECTS],
    protoDirName: 'projects/v1/projects.proto',
  });

  await startGrpcOnlyService(app, 'projects-service', 'PROJECTS_GRPC_PORT', '5003');
}

void bootstrap();
