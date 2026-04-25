import { User } from '@database/entities/auth/user.entity';
import { Auditable, AuditableEntity } from '@database/entities/base/auditable.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Task } from './task.entity';

// Flat comment model. Soft-delete via `is_deleted` flag — comment preserved
// for audit. The AuditableEntity `deletedAt`/`deletedBy` columns also apply
// when using TypeORM's softRemove path.
//
// `comment` is a rich-text editor JSON document (TipTap/ProseMirror tree)
// persisted verbatim as `jsonb` — the server never parses or interprets the
// inner shape.
@Auditable()
@Entity('task_comments')
@Index('idx_task_comments_task_id', ['taskId'])
export class TaskComment extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_task_comments' })
  public readonly id!: string;

  @Column({ name: 'task_id', type: 'uuid' })
  public taskId!: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'task_id',
    foreignKeyConstraintName: 'fk_task_comments_to_tasks',
  })
  public task!: Task;

  @Column({ name: 'author_id', type: 'uuid' })
  public authorId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'author_id',
    foreignKeyConstraintName: 'fk_task_comments_to_users',
  })
  public author!: User;

  @Column({ name: 'comment', type: 'jsonb' })
  public comment!: Record<string, unknown>;

  @Column({ name: 'is_edited', type: 'boolean', default: false })
  public isEdited!: boolean;

  @Column({ name: 'edited_at', type: 'timestamptz', nullable: true })
  public editedAt!: Date | null;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  public isDeleted!: boolean;
}
