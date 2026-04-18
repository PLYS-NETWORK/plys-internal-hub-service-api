import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { TransactionStatus } from '../../enums/transaction-status.enum';
import { WalletTransactionType } from '../../enums/wallet-transaction-type.enum';
import { TraceableEntity } from '../base/traceable.entity';
import { Project } from '../projects/project.entity';
import { Task } from '../tasks/task.entity';
import { ConsultantWallet } from './consultant-wallet.entity';
import { Invoice } from './invoice.entity';

// Append-only ledger. Never UPDATE — write a `reversal` row instead.
// `processor_event_id` is the idempotency key from the payment processor.
@Entity('wallet_transactions')
@Unique('uq_wallet_transactions_processor_event_id', ['processorEventId'])
@Index('idx_wallet_txn_wallet_created', ['walletId'])
@Index('idx_wallet_txn_project', ['projectId'])
@Index('idx_wallet_txn_task', ['taskId'])
export class WalletTransaction extends TraceableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_wallet_transactions' })
  public readonly id!: string;

  @Column({ name: 'wallet_id', type: 'uuid' })
  public walletId!: string;

  @ManyToOne(() => ConsultantWallet, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'wallet_id',
    foreignKeyConstraintName: 'fk_wallet_transactions_to_consultant_wallets',
  })
  public wallet!: ConsultantWallet;

  @Column({ type: 'varchar', length: 20 })
  public type!: WalletTransactionType;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  public amount!: string;

  @Column({ type: 'varchar', length: 20, default: TransactionStatus.COMPLETED })
  public status!: TransactionStatus;

  @Column({ name: 'invoice_id', type: 'uuid', nullable: true })
  public invoiceId!: string | null;

  @ManyToOne(() => Invoice, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'invoice_id',
    foreignKeyConstraintName: 'fk_wallet_transactions_to_invoices',
  })
  public invoice!: Invoice | null;

  @Column({ name: 'task_id', type: 'uuid', nullable: true })
  public taskId!: string | null;

  @ManyToOne(() => Task, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'task_id',
    foreignKeyConstraintName: 'fk_wallet_transactions_to_tasks',
  })
  public task!: Task | null;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  public projectId!: string | null;

  @ManyToOne(() => Project, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'project_id',
    foreignKeyConstraintName: 'fk_wallet_transactions_to_projects',
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
