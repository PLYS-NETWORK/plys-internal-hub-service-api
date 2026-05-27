import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';

import { IWebhookQueueJobPayload, WEBHOOK_JOBS, WEBHOOK_QUEUE } from './webhook-queue.constants';

@Injectable()
export class WebhookQueueService {
  constructor(
    @InjectQueue(WEBHOOK_QUEUE)
    private readonly queue: Queue<IWebhookQueueJobPayload>,
  ) {}

  public async enqueuePolarWebhook(
    payload: Buffer,
    headers: Record<string, string>,
  ): Promise<void> {
    await this.queue.add(WEBHOOK_JOBS.PROCESS_POLAR, {
      payloadBase64: payload.toString('base64'),
      headers,
    });
  }

  public async enqueueStripeWebhook(
    payload: Buffer,
    headers: Record<string, string>,
  ): Promise<void> {
    await this.queue.add(WEBHOOK_JOBS.PROCESS_STRIPE, {
      payloadBase64: payload.toString('base64'),
      headers,
    });
  }
}
