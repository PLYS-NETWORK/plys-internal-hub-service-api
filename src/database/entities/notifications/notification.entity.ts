import { ProjectApplication } from '@database/entities/applications/project-application.entity';
import { User } from '@database/entities/auth/user.entity';
import { Traceable, TraceableEntity } from '@database/entities/base/traceable.entity';
import { Project } from '@database/entities/projects/project.entity';
import { Task } from '@database/entities/tasks/task.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

// Append-only event log per user. `metadata` is intentionally JSONB —
// each notification `type` may carry its own contextual payload (project id,
// task id, dollar amount, etc.). See marketplace_documentation.md §9.
//
// `ref_invoice_id` FK is added by the Domain 8 migration (forward reference,
// fixes §C1 of the original schema where it was inline-declared).
@Traceable()
@Entity('notifications')
@Index('idx_notifications_user_id', ['userId'])
export class Notification extends TraceableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_notifications' })
  public readonly id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  public userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_notifications_to_users',
  })
  public user!: User;

  @Column({ type: 'varchar', length: 60 })
  public type!: string;

  @Column({ type: 'varchar', length: 255 })
  public title!: string;

  @Column({ type: 'text', nullable: true })
  public body!: string | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  public isRead!: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  public readAt!: Date | null;

  @Column({ name: 'ref_project_id', type: 'uuid', nullable: true })
  public refProjectId!: string | null;

  @ManyToOne(() => Project, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'ref_project_id',
    foreignKeyConstraintName: 'fk_notifications_to_projects',
  })
  public refProject!: Project | null;

  @Column({ name: 'ref_task_id', type: 'uuid', nullable: true })
  public refTaskId!: string | null;

  @ManyToOne(() => Task, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'ref_task_id',
    foreignKeyConstraintName: 'fk_notifications_to_tasks',
  })
  public refTask!: Task | null;

  @Column({ name: 'ref_app_id', type: 'uuid', nullable: true })
  public refAppId!: string | null;

  @ManyToOne(() => ProjectApplication, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'ref_app_id',
    foreignKeyConstraintName: 'fk_notifications_to_project_applications',
  })
  public refApplication!: ProjectApplication | null;

  // FK is added in Domain 8 migration after invoices table exists.
  @Column({ name: 'ref_invoice_id', type: 'uuid', nullable: true })
  public refInvoiceId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  public metadata!: Record<string, unknown> | null;
}
