import { User } from '@plys/libraries/database/entities/auth/user.entity';
import { ProjectStatus } from '@plys/libraries/database/enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Project } from './project.entity';

// Append-only audit of project.status transitions. Auto-populated by the
// trg_log_project_status_change trigger on UPDATE projects — services do not
// write rows here directly. Powers the project_status_changed arm of the
// activity-feed CTE.
@Entity('project_status_history')
@Index('idx_project_status_history_project_id', ['projectId', 'changedAt'])
export class ProjectStatusHistory {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_project_status_history' })
  public readonly id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  public projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'project_id',
    foreignKeyConstraintName: 'fk_project_status_history_to_projects',
  })
  public project!: Project;

  @Column({ name: 'previous_status', type: 'varchar', length: 20, nullable: true })
  public previousStatus!: ProjectStatus | null;

  @Column({ name: 'new_status', type: 'varchar', length: 20 })
  public newStatus!: ProjectStatus;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  public changedBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'changed_by',
    foreignKeyConstraintName: 'fk_project_status_history_changed_by_to_users',
  })
  public changer!: User | null;

  @CreateDateColumn({ name: 'changed_at', type: 'timestamptz' })
  public readonly changedAt!: Date;
}
