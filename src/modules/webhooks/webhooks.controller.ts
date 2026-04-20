import { Public } from '@common/decorators/public.decorator';
import { Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';

import { WebhookProcessorService } from './webhook-processor.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhookProcessorService: WebhookProcessorService) {}

  @Post('polar')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiExcludeEndpoint()
  public async handlePolarWebhook(
    @Req() req: FastifyRequest,
    @Headers('webhook-signature') signature: string,
  ): Promise<{ received: boolean }> {
    // Fastify stores raw body in req.rawBody when configured
    const rawBody = (req as FastifyRequest & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      throw new Error('Raw body not available. Ensure rawBody is enabled in Fastify.');
    }

    await this.webhookProcessorService.processPolarWebhook(rawBody, signature);
    return { received: true };
  }

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiExcludeEndpoint()
  public async handleStripeWebhook(
    @Req() req: FastifyRequest,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    const rawBody = (req as FastifyRequest & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      throw new Error('Raw body not available. Ensure rawBody is enabled in Fastify.');
    }

    await this.webhookProcessorService.processStripeWebhook(rawBody, signature);
    return { received: true };
  }
}
