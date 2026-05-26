/**
 * Normalized webhook event type constants.
 * Each provider maps its own event names to these values inside
 * `constructWebhookEvent()` — callers never deal with raw SDK types.
 */
export const WebhookEventType = {
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  REFUND_CREATED: 'refund.created',
  CHECKOUT_COMPLETED: 'checkout.completed',
  UNKNOWN: 'unknown',
} as const;

export type WebhookEventType = (typeof WebhookEventType)[keyof typeof WebhookEventType];

export interface IWebhookEvent {
  readonly type: WebhookEventType;
  /** Normalized payload — provider-specific fields are abstracted away. */
  readonly data: Record<string, unknown>;
  /** Original processor event ID for idempotency checks. */
  readonly processorEventId: string;
}
