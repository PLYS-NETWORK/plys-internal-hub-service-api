import { Metadata } from '@grpc/grpc-js';
import { WebhookQueueService } from '@modules/webhooks/queues/webhook-queue.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  buildSuccessResponse,
  GrpcBridgeBase,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

@Injectable()
export class WebhooksGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    import('@plys/libraries/common-nest/grpc').GrpcBridgeHandler
  >;

  constructor(
    requestContext: RequestContextService,
    private readonly webhookQueueService: WebhookQueueService,
  ) {
    super(requestContext);
    this.handlers = {
      'webhooks.handlePolarWebhook': async (request): Promise<IHttpResponse> => {
        const rawBody = Buffer.isBuffer(request.body)
          ? request.body
          : Buffer.from(request.body ?? []);
        await this.webhookQueueService.enqueuePolarWebhook(rawBody, {
          'webhook-id': request.queryParams?.webhookId ?? '',
          'webhook-timestamp': request.queryParams?.webhookTimestamp ?? '',
          'webhook-signature': request.queryParams?.webhookSignature ?? '',
        });
        return buildSuccessResponse(
          { messageKey: 'success.ok', data: { received: true } },
          HttpStatus.OK,
        );
      },
      'webhooks.handleStripeWebhook': async (request): Promise<IHttpResponse> => {
        const rawBody = Buffer.isBuffer(request.body)
          ? request.body
          : Buffer.from(request.body ?? []);
        await this.webhookQueueService.enqueueStripeWebhook(rawBody, {
          'stripe-signature': request.queryParams?.stripeSignature ?? '',
        });
        return buildSuccessResponse(
          { messageKey: 'success.ok', data: { received: true } },
          HttpStatus.OK,
        );
      },
    };
  }

  @GrpcMethod('Webhooks', 'Dispatch')
  public handleDispatch(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    return super.dispatch(request, metadata);
  }
}
