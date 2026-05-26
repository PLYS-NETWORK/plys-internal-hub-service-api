import { User } from '@plys/libraries/database/entities/auth/user.entity';
import {
  Auditable,
  AuditableEntity,
} from '@plys/libraries/database/entities/base/auditable.entity';
import { OnboardingDecision, OnboardingStatus } from '@plys/libraries/database/enums';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Auditable()
@Entity('consultant_onboardings')
@Unique('uq_consultant_onboardings_user_id', ['userId'])
@Index('idx_consultant_onboardings_status', ['status'])
@Index('idx_consultant_onboardings_user_status', ['userId', 'status'])
export class ConsultantOnboarding extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_consultant_onboardings' })
  public readonly id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  public userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_consultant_onboardings_to_users',
  })
  public user!: User;

  @Column({
    type: 'varchar',
    length: 30,
    default: OnboardingStatus.PENDING_BASIC_INFO,
  })
  public status!: OnboardingStatus;

  @Column({ name: 'profile_submitted_at', type: 'timestamptz', nullable: true })
  public profileSubmittedAt!: Date | null;

  @Column({ name: 'interview_submitted_at', type: 'timestamptz', nullable: true })
  public interviewSubmittedAt!: Date | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  public reviewedBy!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({
    name: 'reviewed_by',
    foreignKeyConstraintName: 'fk_consultant_onboardings_reviewed_by_user',
  })
  public reviewedByUser!: User | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  public reviewedAt!: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  public decision!: OnboardingDecision | null;

  @Column({ name: 'rejection_note', type: 'text', nullable: true })
  public rejectionNote!: string | null;

  @Column({ name: 'blocked_until', type: 'timestamptz', nullable: true })
  public blockedUntil!: Date | null;
}
