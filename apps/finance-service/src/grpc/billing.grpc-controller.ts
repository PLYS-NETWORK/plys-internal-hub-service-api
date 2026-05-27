import { Metadata } from '@grpc/grpc-js';
import { BillingController } from '@modules/billing/billing.controller';
import { HttpStatus, Injectable } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  buildSuccessResponse,
  createControllerBridgeHandlers,
  GrpcBridgeBase,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

@Injectable()
export class BillingGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    import('@plys/libraries/common-nest/grpc').GrpcBridgeHandler
  >;

  constructor(requestContext: RequestContextService, billingController: BillingController) {
    super(requestContext);
    this.handlers = {
      ...createControllerBridgeHandlers(this, [
        {
          prefix: 'billing',
          instance: billingController,
          methods: {
            listBills: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
            getBillDetail: (req): Promise<unknown[]> =>
              Promise.resolve([this.getPathParam(req, 'invoiceId')]),
            sendBillEmail: (req): Promise<unknown[]> =>
              Promise.resolve([this.getPathParam(req, 'invoiceId')]),
          },
        },
      ]),
      'billing.triggerSettlement': async (request): Promise<IHttpResponse> => {
        const result = await billingController.triggerSettlement(this.parseJsonBody(request));
        const statusCode =
          result.messageKey === 'success.created' ? HttpStatus.CREATED : HttpStatus.ACCEPTED;
        return buildSuccessResponse(result, statusCode);
      },
    };
  }

  @GrpcMethod('Billing', 'Dispatch')
  public handleDispatch(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    return super.dispatch(request, metadata);
  }
}
