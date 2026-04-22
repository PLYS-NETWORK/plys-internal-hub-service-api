import { User } from '@database/entities/auth/user.entity';
import { Auditable, AuditableEntity } from '@database/entities/base/auditable.entity';
import { ConsultantProfile } from '@database/entities/profiles/consultant-profile.entity';
import { Project } from '@database/entities/projects/project.entity';
import { ApplicationStatus } from '@database/enums/application-status.enum';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

// Re-application allowed after rejection/withdraw — partial unique index in
// the migration only blocks duplicates among (pending, accepted) statuses.
@Auditable()
@Entity('project_applications')
@Index('idx_applications_project_status', ['projectId', 'status'])
@Index('idx_applications_consultant_id', ['consultantId'])
export class ProjectApplication extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_project_applications' })
  public readonly id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  public projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'project_id',
    foreignKeyConstraintName: 'fk_project_applications_to_projects',
  })
  public project!: Project;

  @Column({ name: 'consultant_id', type: 'uuid' })
  public consultantId!: string;

  @ManyToOne(() => ConsultantProfile, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'consultant_id',
    foreignKeyConstraintName: 'fk_project_applications_to_consultant_profiles',
  })
  public consultant!: ConsultantProfile;

  @Column({ type: 'varchar', length: 20, default: ApplicationStatus.PENDING })
  public status!: ApplicationStatus;

  @Column({ name: 'cover_letter', type: 'text', nullable: true })
  public coverLetter!: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  public reviewedBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'reviewed_by',
    foreignKeyConstraintName: 'fk_project_applications_reviewed_by_to_users',
  })
  public reviewer!: User | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  public reviewedAt!: Date | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  public rejectionReason!: string | null;

  @Column({ name: 'applied_at', type: 'timestamptz', default: () => 'NOW()' })
  public appliedAt!: Date;
}
