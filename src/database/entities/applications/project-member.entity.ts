import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { ProjectMemberStatus } from '../../enums/project-member-status.enum';
import { AuditableEntity } from '../base/auditable.entity';
import { ConsultantProfile } from '../profiles/consultant-profile.entity';
import { Project } from '../projects/project.entity';
import { ProjectApplication } from './project-application.entity';

// Authoritative roster of consultants on a project. Insertion is rate-limited
// per consultant by trg_enforce_consultant_project_limit (§C5 race-fix uses
// FOR UPDATE on consultant_profiles row).
@Entity('project_members')
@Unique('uq_project_members_project_consultant', ['projectId', 'consultantId'])
@Index('idx_project_members_project_id', ['projectId'])
@Index('idx_project_members_consultant_id', ['consultantId'])
export class ProjectMember extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_project_members' })
  public readonly id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  public projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'project_id',
    foreignKeyConstraintName: 'fk_project_members_to_projects',
  })
  public project!: Project;

  @Column({ name: 'consultant_id', type: 'uuid' })
  public consultantId!: string;

  @ManyToOne(() => ConsultantProfile, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'consultant_id',
    foreignKeyConstraintName: 'fk_project_members_to_consultant_profiles',
  })
  public consultant!: ConsultantProfile;

  @Column({ name: 'application_id', type: 'uuid' })
  public applicationId!: string;

  @ManyToOne(() => ProjectApplication, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'application_id',
    foreignKeyConstraintName: 'fk_project_members_to_project_applications',
  })
  public application!: ProjectApplication;

  @Column({ type: 'varchar', length: 20, default: ProjectMemberStatus.ACTIVE })
  public status!: ProjectMemberStatus;

  @Column({ name: 'joined_at', type: 'timestamptz', default: () => 'NOW()' })
  public joinedAt!: Date;

  @Column({ name: 'left_at', type: 'timestamptz', nullable: true })
  public leftAt!: Date | null;
}
