import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { PaymentProcessor } from '@database/enums/payment-processor.enum';
import { WebhookStatus } from '@database/enums/webhook-status.enum';

// Idempotency log of incoming payment processor webhooks. The unique
// constraint scopes event_id by processor (§C4 fix — Stripe and Polar
// might collide otherwise).
@Entity('webhook_events')
@Unique('uq_webhook_events_processor_event_id', ['processor', 'eventId'])
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_webhook_events' })
  public readonly id!: string;

  @Column({ type: 'varchar', length: 50 })
  public processor!: PaymentProcessor;

  @Column({ name: 'event_id', type: 'varchar', length: 255 })
  public eventId!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  public eventType!: string;

  @Column({ type: 'jsonb' })
  public payload!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 20, default: WebhookStatus.PENDING })
  public status!: WebhookStatus;

  @Column({ name: 'retry_count', type: 'smallint', default: 0 })
  public retryCount!: number;

  @Column({ name: 'next_retry_at', type: 'timestamptz', nullable: true })
  public nextRetryAt!: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  public lastError!: string | null;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  public processedAt!: Date | null;

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz' })
  public readonly receivedAt!: Date;
}
