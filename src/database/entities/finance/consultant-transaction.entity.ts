import { Traceable, TraceableEntity } from '@database/entities/base/traceable.entity';
import { ConsultantProfile } from '@database/entities/profiles/consultant-profile.entity';
import { Project } from '@database/entities/projects/project.entity';
import { Task } from '@database/entities/tasks/task.entity';
import { ConsultantTransactionType, TransactionStatus } from '@database/enums';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Invoice } from './invoice.entity';

// Append-only ledger. Never UPDATE — write a `reversal` row instead.
// `processor_event_id` is the idempotency key from the payment processor.
@Traceable()
@Entity('consultant_transactions')
@Unique('uq_consultant_transactions_processor_event_id', ['processorEventId'])
@Index('idx_consultant_txn_consultant_created', ['consultantId'])
@Index('idx_consultant_txn_project', ['projectId'])
@Index('idx_consultant_txn_task', ['taskId'])
export class ConsultantTransaction extends TraceableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_consultant_transactions' })
  public readonly id!: string;

  @Column({ name: 'consultant_id', type: 'uuid' })
  public consultantId!: string;

  @ManyToOne(() => ConsultantProfile, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'consultant_id',
    foreignKeyConstraintName: 'fk_consultant_transactions_to_consultant_profiles',
  })
  public consultant!: ConsultantProfile;

  @Column({ type: 'varchar', length: 20 })
  public type!: ConsultantTransactionType;

  /** Consultant payout amount (after platform fee deduction). */
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  public amount!: string;

  /** Platform commission rate for this transaction (default 0; populated for future use). */
  @Column({ name: 'commission_rate', type: 'numeric', precision: 5, scale: 4, default: 0 })
  public commissionRate!: string;

  /** Commission amount withheld (default 0; populated for future use). */
  @Column({ name: 'commission_amount', type: 'numeric', precision: 12, scale: 2, default: 0 })
  public commissionAmount!: string;

  /** Gross amount before commission = amount + commission_amount (default 0). */
  @Column({ name: 'total_amount', type: 'numeric', precision: 12, scale: 2, default: 0 })
  public totalAmount!: string;

  @Column({ type: 'varchar', length: 20, default: TransactionStatus.COMPLETED })
  public status!: TransactionStatus;

  @Column({ name: 'invoice_id', type: 'uuid', nullable: true })
  public invoiceId!: string | null;

  @ManyToOne(() => Invoice, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'invoice_id',
    foreignKeyConstraintName: 'fk_consultant_transactions_to_invoices',
  })
  public invoice!: Invoice | null;

  @Column({ name: 'task_id', type: 'uuid', nullable: true })
  public taskId!: string | null;

  @ManyToOne(() => Task, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'task_id',
    foreignKeyConstraintName: 'fk_consultant_transactions_to_tasks',
  })
  public task!: Task | null;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  public projectId!: string | null;

  @ManyToOne(() => Project, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'project_id',
    foreignKeyConstraintName: 'fk_consultant_transactions_to_projects',
  })
  public project!: Project | null;

  @Column({ name: 'withdrawal_method', type: 'varchar', length: 50, nullable: true })
  public withdrawalMethod!: string | null;

  @Column({
    name: 'withdrawal_reference',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  public withdrawalReference!: string | null;

  @Column({
    name: 'processor_event_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  public processorEventId!: string | null;

  @Column({ type: 'text', nullable: true })
  public note!: string | null;
}
