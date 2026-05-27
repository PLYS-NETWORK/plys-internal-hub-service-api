import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';

import { GrpcDispatchClientBase } from '../base/grpc-dispatch.client';

export const FINANCE_GRPC = 'FINANCE_GRPC';

@Injectable()
export class PaymentsClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'Payments';
  constructor(@Inject(FINANCE_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class BillingClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'Billing';
  constructor(@Inject(FINANCE_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class WebhooksClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'Webhooks';
  constructor(@Inject(FINANCE_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}
