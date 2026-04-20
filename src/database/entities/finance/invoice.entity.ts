import { AuditableEntity } from '@database/entities/base/auditable.entity';
import { BusinessProfile } from '@database/entities/profiles/business-profile.entity';
import { InvoiceStatus } from '@database/enums/invoice-status.enum';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { BillingPeriod } from './billing-period.entity';

@Entity('invoices')
@Unique('uq_invoices_processor_invoice_id', ['processorInvoiceId'])
@Index('idx_invoices_business_id', ['businessId'])
@Index('idx_invoices_status', ['status'])
export class Invoice extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_invoices' })
  public readonly id!: string;

  @Column({ name: 'billing_period_id', type: 'uuid', unique: true })
  public billingPeriodId!: string;

  @OneToOne(() => BillingPeriod, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'billing_period_id',
    foreignKeyConstraintName: 'fk_invoices_to_billing_periods',
  })
  public billingPeriod!: BillingPeriod;

  @Column({ name: 'business_id', type: 'uuid' })
  public businessId!: string;

  @ManyToOne(() => BusinessProfile, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'business_id',
    foreignKeyConstraintName: 'fk_invoices_to_business_profiles',
  })
  public business!: BusinessProfile;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  public amount!: string;

  @Column({ type: 'char', length: 3, default: 'USD' })
  public currency!: string;

  @Column({ type: 'varchar', length: 20, default: InvoiceStatus.PENDING })
  public status!: InvoiceStatus;

  @Column({ name: 'processor_name', type: 'varchar', length: 50, nullable: true })
  public processorName!: string | null;

  @Column({
    name: 'processor_invoice_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  public processorInvoiceId!: string | null;

  @Column({
    name: 'processor_payment_intent_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  public processorPaymentIntentId!: string | null;

  @Column({ name: 'processor_payment_url', type: 'text', nullable: true })
  public processorPaymentUrl!: string | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  public dueDate!: string | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  public paidAt!: Date | null;
}
