import { Global, Module } from '@nestjs/common';
import { GrpcGatewayHelper } from '@plys/libraries/common-nest/grpc';

@Global()
@Module({
  providers: [GrpcGatewayHelper],
  exports: [GrpcGatewayHelper],
})
export class GatewayGrpcModule {}
