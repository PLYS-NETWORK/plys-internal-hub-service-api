import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE_WEBHOOK } from '@plys/libraries/common-nest/constants';
import { Public } from '@plys/libraries/common-nest/decorators/public.decorator';
import { assertGrpcSuccess, GrpcGatewayHelper } from '@plys/libraries/common-nest/grpc';
import { FastifyRequest } from 'fastify';

import { WebhooksClient } from '@/clients/v1/finance';

@ApiTags('Webhooks')
@Controller('finance/webhooks')
@Throttle(THROTTLE_WEBHOOK)
export class FinanceWebhooksController {
  constructor(
    private readonly webhooksClient: WebhooksClient,
    private readonly grpcHelper: GrpcGatewayHelper,
  ) {}

  @Post('polar')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiExcludeEndpoint()
  public async handlePolarWebhook(
    @Req() req: RawBodyRequest<FastifyRequest>,
    @Headers('webhook-id') webhookId: string,
    @Headers('webhook-timestamp') webhookTimestamp: string,
    @Headers('webhook-signature') webhookSignature: string,
  ): Promise<{ received: boolean }> {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new Error('Raw body not available. Ensure rawBody is enabled in NestFactory.create.');
    }

    const response = await this.grpcHelper.callRaw(this.webhooksClient, {
      operation: 'webhooks.handlePolarWebhook',
      body: rawBody,
      queryParams: {
        webhookId,
        webhookTimestamp,
        webhookSignature,
      },
    });
    const payload = assertGrpcSuccess<{ received: boolean }>(response);
    return payload.data ?? { received: true };
  }

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiExcludeEndpoint()
  public async handleStripeWebhook(
    @Req() req: RawBodyRequest<FastifyRequest>,
    @Headers('stripe-signature') stripeSignature: string,
  ): Promise<{ received: boolean }> {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new Error('Raw body not available. Ensure rawBody is enabled in NestFactory.create.');
    }

    const response = await this.grpcHelper.callRaw(this.webhooksClient, {
      operation: 'webhooks.handleStripeWebhook',
      body: rawBody,
      queryParams: { stripeSignature },
    });
    const payload = assertGrpcSuccess<{ received: boolean }>(response);
    return payload.data ?? { received: true };
  }
}
