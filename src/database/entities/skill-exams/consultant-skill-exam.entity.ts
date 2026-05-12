import { Auditable, AuditableEntity } from '@database/entities/base/auditable.entity';
import { ConsultantProfile } from '@database/entities/profiles/consultant-profile.entity';
import { Skill } from '@database/entities/profiles/skill.entity';
import { ProficiencyLevel, SkillExamFailReason, SkillExamStatus } from '@database/enums';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Auditable()
@Entity('consultant_skill_exams')
@Index('idx_consultant_skill_exams_consultant_status', ['consultantId', 'status'])
@Index('idx_consultant_skill_exams_consultant_skill', ['consultantId', 'skillId'])
export class ConsultantSkillExam extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_consultant_skill_exams' })
  public readonly id!: string;

  @Column({ name: 'consultant_id', type: 'uuid' })
  public consultantId!: string;

  @ManyToOne(() => ConsultantProfile, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'consultant_id',
    foreignKeyConstraintName: 'fk_consultant_skill_exams_to_consultant_profiles',
  })
  public consultant!: ConsultantProfile;

  @Column({ name: 'skill_id', type: 'uuid' })
  public skillId!: string;

  @ManyToOne(() => Skill, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'skill_id',
    foreignKeyConstraintName: 'fk_consultant_skill_exams_to_skills',
  })
  public skill!: Skill;

  @Column({
    type: 'varchar',
    length: 30,
    default: SkillExamStatus.GENERATING_QUESTIONS,
  })
  public status!: SkillExamStatus;

  @Column({ name: 'attempt_number', type: 'smallint', default: 1 })
  public attemptNumber!: number;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  public startedAt!: Date | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  public submittedAt!: Date | null;

  @Column({ name: 'copyleaks_checked_at', type: 'timestamptz', nullable: true })
  public copyleaksCheckedAt!: Date | null;

  @Column({ name: 'ai_eval_completed_at', type: 'timestamptz', nullable: true })
  public aiEvalCompletedAt!: Date | null;

  @Column({ name: 'concluded_at', type: 'timestamptz', nullable: true })
  public concludedAt!: Date | null;

  @Column({
    name: 'copyleaks_aggregate_score',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  public copyleaksAggregateScore!: string | null;

  @Column({
    name: 'ai_eval_score',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  public aiEvalScore!: string | null;

  @Column({ name: 'correct_count', type: 'smallint', nullable: true })
  public correctCount!: number | null;

  @Column({
    name: 'assigned_proficiency',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  public assignedProficiency!: ProficiencyLevel | null;

  @Column({ name: 'cooldown_until', type: 'timestamptz', nullable: true })
  public cooldownUntil!: Date | null;

  @Column({ name: 'fail_reason', type: 'varchar', length: 30, nullable: true })
  public failReason!: SkillExamFailReason | null;
}
