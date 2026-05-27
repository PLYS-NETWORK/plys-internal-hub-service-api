import { Global, Module } from '@nestjs/common';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';

import { createGrpcClientModuleOptions } from '../base/create-grpc-client-module.util';
import { GatewayGrpcModule } from '../base/grpc-gateway.module';
import {
  BillingClient,
  FINANCE_GRPC,
  PaymentsClient,
  WebhooksClient,
} from './finance-grpc.clients';

@Global()
@Module({
  imports: [
    GatewayGrpcModule,
    createGrpcClientModuleOptions(
      'FINANCE',
      FINANCE_GRPC,
      (env: EnvironmentsService) => env.financeServiceGrpcUrl,
    ),
  ],
  providers: [PaymentsClient, BillingClient, WebhooksClient],
  exports: [PaymentsClient, BillingClient, WebhooksClient],
})
export class FinanceClientsModule {}
