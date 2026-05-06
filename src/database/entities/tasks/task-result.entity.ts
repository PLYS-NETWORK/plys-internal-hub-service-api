import { User } from '@database/entities/auth/user.entity';
import { Auditable, AuditableEntity } from '@database/entities/base/auditable.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  VersionColumn,
} from 'typeorm';

import { Task } from './task.entity';

// Structured deliverable record authored by the assigned consultant.
// `remarks` is a rich-text JSON document produced by the client editor — the
// server treats it as opaque JSONB and never parses or validates inner shape.
// Soft-delete via `is_deleted` flag; body preserved for audit. Optimistic
// lock via @VersionColumn since results are editable.
@Auditable()
@Entity('task_results')
@Index('idx_task_results_task_id', ['taskId'])
@Index('idx_task_results_author_id', ['authorId'])
export class TaskResult extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_task_results' })
  public readonly id!: string;

  @Column({ name: 'task_id', type: 'uuid' })
  public taskId!: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'task_id',
    foreignKeyConstraintName: 'fk_task_results_to_tasks',
  })
  public task!: Task;

  @Column({ name: 'author_id', type: 'uuid' })
  public authorId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'author_id',
    foreignKeyConstraintName: 'fk_task_results_to_users',
  })
  public author!: User;

  @Column({ type: 'jsonb' })
  public remarks!: Record<string, unknown>;

  @Column({ name: 'is_edited', type: 'boolean', default: false })
  public isEdited!: boolean;

  @Column({ name: 'edited_at', type: 'timestamptz', nullable: true })
  public editedAt!: Date | null;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  public isDeleted!: boolean;

  @VersionColumn()
  public readonly version!: number;
}
