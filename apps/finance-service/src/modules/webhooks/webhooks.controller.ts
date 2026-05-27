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
import { FastifyRequest } from 'fastify';

import { WebhookQueueService } from './queues/webhook-queue.service';

@ApiTags('Webhooks')
@Controller('webhooks')
@Throttle(THROTTLE_WEBHOOK)
export class WebhooksController {
  constructor(private readonly webhookQueueService: WebhookQueueService) {}

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

    const headers: Record<string, string> = {
      'webhook-id': webhookId,
      'webhook-timestamp': webhookTimestamp,
      'webhook-signature': webhookSignature,
    };

    await this.webhookQueueService.enqueuePolarWebhook(rawBody, headers);
    return { received: true };
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

    await this.webhookQueueService.enqueueStripeWebhook(rawBody, {
      'stripe-signature': stripeSignature,
    });
    return { received: true };
  }
}
