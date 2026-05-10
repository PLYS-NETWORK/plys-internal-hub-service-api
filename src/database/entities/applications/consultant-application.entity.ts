import { User } from '@database/entities/auth/user.entity';
import { Auditable, AuditableEntity } from '@database/entities/base/auditable.entity';
import { ApplicationStatus } from '@database/enums';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Auditable()
@Entity('consultant_applications')
@Index('idx_consultant_applications_user_id', ['userId'])
@Index('idx_consultant_applications_status', ['status'])
@Index('idx_consultant_applications_user_status', ['userId', 'status'])
export class ConsultantApplication extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_consultant_applications' })
  public readonly id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  public userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_consultant_applications_to_users',
  })
  public user!: User;

  @Column({
    type: 'varchar',
    length: 30,
    default: ApplicationStatus.PENDING_PROFILE,
  })
  public status!: ApplicationStatus;

  @Column({ name: 'profile_submitted_at', type: 'timestamptz', nullable: true })
  public profileSubmittedAt!: Date | null;

  @Column({ name: 'interview_submitted_at', type: 'timestamptz', nullable: true })
  public interviewSubmittedAt!: Date | null;

  @Column({ name: 'admin_triggered_by', type: 'uuid', nullable: true })
  public adminTriggeredBy!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({
    name: 'admin_triggered_by',
    foreignKeyConstraintName: 'fk_consultant_applications_triggered_by_user',
  })
  public adminTriggeredByUser!: User | null;

  @Column({ name: 'admin_triggered_at', type: 'timestamptz', nullable: true })
  public adminTriggeredAt!: Date | null;

  @Column({
    name: 'copyleaks_score',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  public copyleaksScore!: string | null;

  @Column({ name: 'copyleaks_checked_at', type: 'timestamptz', nullable: true })
  public copyleaksCheckedAt!: Date | null;

  @Column({
    name: 'ai_eval_score',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  public aiEvalScore!: string | null;

  @Column({ name: 'ai_eval_completed_at', type: 'timestamptz', nullable: true })
  public aiEvalCompletedAt!: Date | null;

  @Column({
    name: 'admin_eval_score',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  public adminEvalScore!: string | null;

  @Column({ name: 'admin_eval_completed_by', type: 'uuid', nullable: true })
  public adminEvalCompletedBy!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({
    name: 'admin_eval_completed_by',
    foreignKeyConstraintName: 'fk_consultant_applications_admin_eval_by_user',
  })
  public adminEvalCompletedByUser!: User | null;

  @Column({ name: 'admin_eval_completed_at', type: 'timestamptz', nullable: true })
  public adminEvalCompletedAt!: Date | null;

  @Column({
    name: 'final_score',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  public finalScore!: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  public reviewedBy!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({
    name: 'reviewed_by',
    foreignKeyConstraintName: 'fk_consultant_applications_reviewed_by_user',
  })
  public reviewedByUser!: User | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  public reviewedAt!: Date | null;

  @Column({ name: 'blocked_until', type: 'timestamptz', nullable: true })
  public blockedUntil!: Date | null;

  @Column({ name: 'rejection_reason', type: 'varchar', length: 30, nullable: true })
  public rejectionReason!: string | null;
}
