import {
  connectDomainGrpcMicroservice,
  createGrpcHostApplication,
  startGrpcOnlyService,
} from '@plys/libraries/common-nest/grpc';
import { GRPC_PACKAGES, INTERNAL_TASK_REVIEWER_PROTO_PATH } from '@plys/libraries/proto';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await createGrpcHostApplication(AppModule, { bufferLogs: true });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  connectDomainGrpcMicroservice(app, {
    grpcPortEnv: 'INTERNAL_TASK_REVIEWER_GRPC_PORT',
    defaultPort: '5005',
    domainProtoPath: INTERNAL_TASK_REVIEWER_PROTO_PATH,
    packages: [GRPC_PACKAGES.INTERNAL_TASK_REVIEWER],
    protoDirName: 'internal-task-reviewer/v1/internal-task-reviewer.proto',
  });

  await startGrpcOnlyService(
    app,
    'internal-task-reviewer-service',
    'INTERNAL_TASK_REVIEWER_GRPC_PORT',
    '5005',
  );
}

void bootstrap();
