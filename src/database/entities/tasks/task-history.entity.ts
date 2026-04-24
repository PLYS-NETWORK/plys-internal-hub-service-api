import { User } from '@database/entities/auth/user.entity';
import { ConsultantProfile } from '@database/entities/profiles/consultant-profile.entity';
import { TaskHistoryChangeType, TaskKanbanStatus } from '@database/enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Task } from './task.entity';

// Append-only audit. Auto-populated by trg_log_task_change (§H3) — services
// do not need to write rows themselves.
@Entity('task_history')
@Index('idx_task_history_task_id', ['taskId', 'changedAt'])
export class TaskHistory {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_task_history' })
  public readonly id!: string;

  @Column({ name: 'task_id', type: 'uuid' })
  public taskId!: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'task_id',
    foreignKeyConstraintName: 'fk_task_history_to_tasks',
  })
  public task!: Task;

  @Column({ name: 'previous_kanban_status', type: 'varchar', length: 25, nullable: true })
  public previousKanbanStatus!: TaskKanbanStatus | null;

  @Column({ name: 'new_kanban_status', type: 'varchar', length: 25, nullable: true })
  public newKanbanStatus!: TaskKanbanStatus | null;

  @Column({ name: 'previous_assigned_to', type: 'uuid', nullable: true })
  public previousAssignedTo!: string | null;

  @ManyToOne(() => ConsultantProfile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'previous_assigned_to',
    foreignKeyConstraintName: 'fk_task_history_prev_assignee_to_consultant_profiles',
  })
  public previousAssignee!: ConsultantProfile | null;

  @Column({ name: 'new_assigned_to', type: 'uuid', nullable: true })
  public newAssignedTo!: string | null;

  @ManyToOne(() => ConsultantProfile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'new_assigned_to',
    foreignKeyConstraintName: 'fk_task_history_new_assignee_to_consultant_profiles',
  })
  public newAssignee!: ConsultantProfile | null;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  public changedBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'changed_by',
    foreignKeyConstraintName: 'fk_task_history_changed_by_to_users',
  })
  public changer!: User | null;

  @Column({ name: 'change_type', type: 'varchar', length: 30 })
  public changeType!: TaskHistoryChangeType;

  @Column({ type: 'text', nullable: true })
  public note!: string | null;

  @CreateDateColumn({ name: 'changed_at', type: 'timestamptz' })
  public readonly changedAt!: Date;
}
