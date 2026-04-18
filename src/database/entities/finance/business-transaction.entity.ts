import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { BusinessTransactionType } from '../../enums/business-transaction-type.enum';
import { TransactionStatus } from '../../enums/transaction-status.enum';
import { TraceableEntity } from '../base/traceable.entity';
import { BusinessProfile } from '../profiles/business-profile.entity';
import { Project } from '../projects/project.entity';
import { Task } from '../tasks/task.entity';
import { Invoice } from './invoice.entity';

@Entity('business_transactions')
@Unique('uq_business_transactions_processor_event_id', ['processorEventId'])
@Index('idx_business_txn_business', ['businessId'])
@Index('idx_business_txn_project', ['projectId'])
export class BusinessTransaction extends TraceableEntity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_business_transactions',
  })
  public readonly id!: string;

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

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  public amount!: string;

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
}
