import { User } from '@plys/libraries/database/entities/auth/user.entity';
import {
  Auditable,
  AuditableEntity,
} from '@plys/libraries/database/entities/base/auditable.entity';
import { TaskDisputeStatus } from '@plys/libraries/database/enums';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Task } from './task.entity';

// Opened when business rejects work at pending_approval. Side-effect on
// `tasks.kanban_status` is handled by trg_sync_task_dispute_status (§H5).
@Auditable()
@Entity('task_disputes')
@Index('idx_task_disputes_task_id', ['taskId'])
export class TaskDispute extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_task_disputes' })
  public readonly id!: string;

  @Column({ name: 'task_id', type: 'uuid' })
  public taskId!: string;

  @ManyToOne(() => Task, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'task_id',
    foreignKeyConstraintName: 'fk_task_disputes_to_tasks',
  })
  public task!: Task;

  @Column({ name: 'opened_by', type: 'uuid' })
  public openedBy!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'opened_by',
    foreignKeyConstraintName: 'fk_task_disputes_opened_by_to_users',
  })
  public opener!: User;

  @Column({ type: 'text' })
  public reason!: string;

  @Column({
    type: 'varchar',
    length: 25,
    default: TaskDisputeStatus.OPEN,
  })
  public status!: TaskDisputeStatus;

  @Column({ name: 'resolution_note', type: 'text', nullable: true })
  public resolutionNote!: string | null;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  public resolvedBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'resolved_by',
    foreignKeyConstraintName: 'fk_task_disputes_resolved_by_to_users',
  })
  public resolver!: User | null;

  @Column({ name: 'opened_at', type: 'timestamptz', default: () => 'NOW()' })
  public openedAt!: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  public resolvedAt!: Date | null;
}
