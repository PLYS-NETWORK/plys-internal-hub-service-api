import { Process, Processor } from '@nestjs/bull';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { Job } from 'bull';

import { WebhookProcessorService } from '../webhook-processor.service';
import { IWebhookQueueJobPayload, WEBHOOK_JOBS, WEBHOOK_QUEUE } from './webhook-queue.constants';

@Processor(WEBHOOK_QUEUE)
export class WebhookQueueProcessor {
  private readonly logger: AppLogger;

  constructor(
    private readonly webhookProcessorService: WebhookProcessorService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(WebhookQueueProcessor.name, requestContext);
  }

  @Process(WEBHOOK_JOBS.PROCESS_POLAR)
  public async processPolar(job: Job<IWebhookQueueJobPayload>): Promise<void> {
    const payload = Buffer.from(job.data.payloadBase64, 'base64');
    await this.webhookProcessorService.processPolarWebhook(payload, job.data.headers);
    this.logger.log(`processPolar — complete | jobId: ${job.id}`);
  }

  @Process(WEBHOOK_JOBS.PROCESS_STRIPE)
  public async processStripe(job: Job<IWebhookQueueJobPayload>): Promise<void> {
    const payload = Buffer.from(job.data.payloadBase64, 'base64');
    await this.webhookProcessorService.processStripeWebhook(payload, job.data.headers);
    this.logger.log(`processStripe — complete | jobId: ${job.id}`);
  }
}
