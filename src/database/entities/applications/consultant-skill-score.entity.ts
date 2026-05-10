import { ConsultantApplication } from '@database/entities/applications/consultant-application.entity';
import { Traceable, TraceableEntity } from '@database/entities/base/traceable.entity';
import { ConsultantProfile } from '@database/entities/profiles/consultant-profile.entity';
import { Skill } from '@database/entities/profiles/skill.entity';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

// Composite PK on (consultant_id, skill_id) — upserted on each successful approval.
// Stores the latest skill-specific score for project matching.
@Traceable()
@Entity('consultant_skill_scores')
export class ConsultantSkillScore extends TraceableEntity {
  @PrimaryColumn({
    name: 'consultant_id',
    type: 'uuid',
    primaryKeyConstraintName: 'pk_consultant_skill_scores',
  })
  public consultantId!: string;

  @PrimaryColumn({
    name: 'skill_id',
    type: 'uuid',
    primaryKeyConstraintName: 'pk_consultant_skill_scores',
  })
  public skillId!: string;

  @ManyToOne(() => ConsultantProfile, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'consultant_id',
    foreignKeyConstraintName: 'fk_consultant_skill_scores_to_consultant_profiles',
  })
  public consultant!: ConsultantProfile;

  @ManyToOne(() => Skill, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'skill_id',
    foreignKeyConstraintName: 'fk_consultant_skill_scores_to_skills',
  })
  public skill!: Skill;

  @Column({ name: 'application_id', type: 'uuid' })
  public applicationId!: string;

  @ManyToOne(() => ConsultantApplication, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'application_id',
    foreignKeyConstraintName: 'fk_consultant_skill_scores_to_applications',
  })
  public application!: ConsultantApplication;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  public score!: string;

  @Column({ name: 'calculated_at', type: 'timestamptz' })
  public calculatedAt!: Date;
}
