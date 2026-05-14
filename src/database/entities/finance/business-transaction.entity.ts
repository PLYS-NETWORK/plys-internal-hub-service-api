import { Traceable, TraceableEntity } from '@database/entities/base/traceable.entity';
import { BusinessProfile } from '@database/entities/profiles/business-profile.entity';
import { Project } from '@database/entities/projects/project.entity';
import { Task } from '@database/entities/tasks/task.entity';
import { BusinessTransactionType, TransactionStatus } from '@database/enums';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { IPayerInfo } from './interfaces/payer-info.interface';
import { Invoice } from './invoice.entity';

@Traceable()
@Entity('business_transactions')
@Unique('uq_business_transactions_processor_event_id', ['processorEventId'])
@Unique('uq_business_transactions_number', ['transactionNumber'])
@Index('idx_business_txn_business', ['businessId'])
@Index('idx_business_txn_project', ['projectId'])
export class BusinessTransaction extends TraceableEntity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_business_transactions',
  })
  public readonly id!: string;

  /**
   * Human-facing identifier `[PLS][SHORT_TYPE][YYYYMMDD][N]` (no separators)
   * — generated atomically per ledger per day by `TransactionNumberService`.
   * Quoted on receipts, refunds, and invoices for support lookups.
   */
  @Column({ name: 'transaction_number', type: 'varchar', length: 32 })
  public transactionNumber!: string;

  @Column({ name: 'business_id', type: 'uuid' })
  public businessId!: string;

  @ManyToOne(() => BusinessProfile, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'business_id',
    foreignKeyConstraintName: 'fk_business_transactions_to_business_profiles',
  })
  public business!: BusinessProfile;

  @Column({ type: 'varchar', length: 25 })
  public type!: BusinessTransactionType;

  /** Base/subtotal amount before commission (e.g. task prices sum, top-up value). */
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  public amount!: string;

  /** Commission rate snapshot; null for transaction types where commission does not apply. */
  @Column({ name: 'commission_rate', type: 'numeric', precision: 5, scale: 4, nullable: true })
  public commissionRate!: string | null;

  /** Commission amount = amount × commission_rate; null when commission does not apply. */
  @Column({ name: 'commission_amount', type: 'numeric', precision: 12, scale: 2, nullable: true })
  public commissionAmount!: string | null;

  /** Total charged = amount + commission_amount (equals amount when commission is null). */
  @Column({ name: 'total_amount', type: 'numeric', precision: 12, scale: 2 })
  public totalAmount!: string;

  @Column({ type: 'varchar', length: 20, default: TransactionStatus.COMPLETED })
  public status!: TransactionStatus;

  @Column({ name: 'invoice_id', type: 'uuid', nullable: true })
  public invoiceId!: string | null;

  @ManyToOne(() => Invoice, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'invoice_id',
    foreignKeyConstraintName: 'fk_business_transactions_to_invoices',
  })
  public invoice!: Invoice | null;

  @Column({ name: 'task_id', type: 'uuid', nullable: true })
  public taskId!: string | null;

  @ManyToOne(() => Task, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'task_id',
    foreignKeyConstraintName: 'fk_business_transactions_to_tasks',
  })
  public task!: Task | null;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  public projectId!: string | null;

  @ManyToOne(() => Project, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'project_id',
    foreignKeyConstraintName: 'fk_business_transactions_to_projects',
  })
  public project!: Project | null;

  @Column({
    name: 'processor_event_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  public processorEventId!: string | null;

  @Column({ type: 'text', nullable: true })
  public note!: string | null;

  @Column({ name: 'payer_info', type: 'jsonb', nullable: true })
  public payerInfo!: IPayerInfo | null;
}
