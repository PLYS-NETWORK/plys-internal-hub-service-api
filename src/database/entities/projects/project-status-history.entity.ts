import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ProjectStatus } from '../../enums/project-status.enum';
import { User } from '../auth/user.entity';
import { Project } from './project.entity';

// Append-only audit. Auto-populated by trigger on projects status change
// (§H3 fix), so app code does not need to insert rows itself.
@Entity('project_status_history')
@Index('idx_project_status_history_project_id', ['projectId'])
export class ProjectStatusHistory {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_project_status_history',
  })
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
    foreignKeyConstraintName: 'fk_project_status_history_to_users',
  })
  public changedByUser!: User | null;

  @Column({ type: 'text', nullable: true })
  public note!: string | null;

  @CreateDateColumn({ name: 'changed_at', type: 'timestamptz' })
  public readonly changedAt!: Date;
}
