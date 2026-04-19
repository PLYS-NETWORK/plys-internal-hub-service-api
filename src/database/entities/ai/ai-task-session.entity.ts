import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { User } from '@database/entities/auth/user.entity';
import { AuditableEntity } from '@database/entities/base/auditable.entity';
import { Project } from '@database/entities/projects/project.entity';

// One active session per (project_id, user_id) — enforced by partial unique
// index in the migration. Closing a session sets is_active = FALSE; history
// is preserved, never deleted.
@Entity('ai_task_sessions')
@Index('idx_ai_sessions_project_user', ['projectId', 'userId'])
export class AiTaskSession extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_ai_task_sessions' })
  public readonly id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  public projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'project_id',
    foreignKeyConstraintName: 'fk_ai_task_sessions_to_projects',
  })
  public project!: Project;

  @Column({ name: 'user_id', type: 'uuid' })
  public userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_ai_task_sessions_to_users',
  })
  public user!: User;

  @Column({ type: 'varchar', length: 255, nullable: true })
  public title!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  public isActive!: boolean;
}
