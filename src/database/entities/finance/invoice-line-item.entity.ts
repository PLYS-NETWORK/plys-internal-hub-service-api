import { TraceableEntity } from '@database/entities/base/traceable.entity';
import { ConsultantProfile } from '@database/entities/profiles/consultant-profile.entity';
import { Project } from '@database/entities/projects/project.entity';
import { Task } from '@database/entities/tasks/task.entity';
import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Invoice } from './invoice.entity';

// Snapshot of task pricing at billing time. CHECK ensures
// `amount = platform_fee_amount + consultant_payout` so the snapshot stays
// internally consistent (§M8 fix).
@Entity('invoice_line_items')
@Unique('uq_invoice_line_items_invoice_task', ['invoiceId', 'taskId'])
@Check(
  'ck_invoice_line_items_amount_split',
  '"amount" = "platform_fee_amount" + "consultant_payout"',
)
@Index('idx_invoice_line_items_invoice', ['invoiceId'])
@Index('idx_invoice_line_items_consultant', ['consultantId'])
@Index('idx_invoice_line_items_task', ['taskId'])
export class InvoiceLineItem extends TraceableEntity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_invoice_line_items',
  })
  public readonly id!: string;

  @Column({ name: 'invoice_id', type: 'uuid' })
  public invoiceId!: string;

  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'invoice_id',
    foreignKeyConstraintName: 'fk_invoice_line_items_to_invoices',
  })
  public invoice!: Invoice;

  @Column({ name: 'task_id', type: 'uuid' })
  public taskId!: string;

  @ManyToOne(() => Task, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'task_id',
    foreignKeyConstraintName: 'fk_invoice_line_items_to_tasks',
  })
  public task!: Task;

  @Column({ name: 'consultant_id', type: 'uuid' })
  public consultantId!: string;

  @ManyToOne(() => ConsultantProfile, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'consultant_id',
    foreignKeyConstraintName: 'fk_invoice_line_items_to_consultant_profiles',
  })
  public consultant!: ConsultantProfile;

  @Column({ name: 'project_id', type: 'uuid' })
  public projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'project_id',
    foreignKeyConstraintName: 'fk_invoice_line_items_to_projects',
  })
  public project!: Project;

  @Column({ type: 'text', nullable: true })
  public description!: string | null;

  @Column({ type: 'char', length: 3, default: 'USD' })
  public currency!: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  public amount!: string;

  @Column({
    name: 'platform_fee_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
  })
  public platformFeeAmount!: string;

  @Column({ name: 'consultant_payout', type: 'numeric', precision: 10, scale: 2 })
  public consultantPayout!: string;
}
