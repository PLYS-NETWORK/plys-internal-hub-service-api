import { Metadata } from '@grpc/grpc-js';
import { AdminPaymentsController } from '@modules/payments/admin/admin-payments.controller';
import { BusinessPaymentsController } from '@modules/payments/business/business-payments.controller';
import { ConsultantPaymentsController } from '@modules/payments/consultant/consultant-payments.controller';
import { PaymentsController } from '@modules/payments/payments.controller';
import { Injectable } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  createControllerBridgeHandlers,
  GrpcBridgeBase,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

@Injectable()
export class PaymentsGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    import('@plys/libraries/common-nest/grpc').GrpcBridgeHandler
  >;

  constructor(
    requestContext: RequestContextService,
    paymentsController: PaymentsController,
    businessPaymentsController: BusinessPaymentsController,
    consultantPaymentsController: ConsultantPaymentsController,
    adminPaymentsController: AdminPaymentsController,
  ) {
    super(requestContext);
    this.handlers = createControllerBridgeHandlers(this, [
      {
        prefix: 'payments',
        instance: paymentsController,
        methods: {
          createWithdraw: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
          cancelWithdraw: (req): Promise<unknown[]> =>
            Promise.resolve([{ transactionId: this.getPathParam(req, 'transaction_id') }]),
        },
      },
      {
        prefix: 'businessPayments',
        instance: businessPaymentsController,
        methods: {
          createTopUp: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
          continueTopUp: (req): Promise<unknown[]> =>
            Promise.resolve([{ transactionId: this.getPathParam(req, 'transaction_id') }]),
          cancelTopUp: (req): Promise<unknown[]> =>
            Promise.resolve([{ transactionId: this.getPathParam(req, 'transaction_id') }]),
          settleInvoice: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
          listTransactions: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
        },
      },
      {
        prefix: 'consultantPayments',
        instance: consultantPaymentsController,
        methods: {
          listTransactions: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
        },
      },
      {
        prefix: 'adminPayments',
        instance: adminPaymentsController,
        methods: {
          listConsultantTransactions: (req): Promise<unknown[]> =>
            Promise.resolve([this.parseJsonBody(req)]),
          listBusinessTransactions: (req): Promise<unknown[]> =>
            Promise.resolve([this.parseJsonBody(req)]),
        },
      },
    ]);
  }

  @GrpcMethod('Payments', 'Dispatch')
  public handleDispatch(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    return super.dispatch(request, metadata);
  }
}
