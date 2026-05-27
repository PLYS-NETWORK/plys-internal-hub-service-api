export const WEBHOOK_QUEUE = 'finance-webhooks';

export const WEBHOOK_JOBS = {
  PROCESS_POLAR: 'process-polar',
  PROCESS_STRIPE: 'process-stripe',
} as const;

export interface IWebhookQueueJobPayload {
  readonly payloadBase64: string;
  readonly headers: Record<string, string>;
}
