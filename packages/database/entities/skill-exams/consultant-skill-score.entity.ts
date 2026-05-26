import {
  Traceable,
  TraceableEntity,
} from '@plys/libraries/database/entities/base/traceable.entity';
import { ConsultantProfile } from '@plys/libraries/database/entities/profiles/consultant-profile.entity';
import { Skill } from '@plys/libraries/database/entities/profiles/skill.entity';
import { ConsultantSkillExam } from '@plys/libraries/database/entities/skill-exams/consultant-skill-exam.entity';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

// Append-only audit log of every passed skill exam. One row per (consultant, exam).
// The most recent score for a (consultant, skill) is denormalized to
// `consultant_skills.rating` for cheap reads on project matching.
@Traceable()
@Entity('consultant_skill_scores')
export class ConsultantSkillScore extends TraceableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_consultant_skill_scores' })
  public readonly id!: string;

  @Column({ name: 'consultant_id', type: 'uuid' })
  public consultantId!: string;

  @ManyToOne(() => ConsultantProfile, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'consultant_id',
    foreignKeyConstraintName: 'fk_consultant_skill_scores_to_consultant_profiles',
  })
  public consultant!: ConsultantProfile;

  @Column({ name: 'skill_id', type: 'uuid' })
  public skillId!: string;

  @ManyToOne(() => Skill, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'skill_id',
    foreignKeyConstraintName: 'fk_consultant_skill_scores_to_skills',
  })
  public skill!: Skill;

  @Column({ name: 'exam_id', type: 'uuid' })
  public examId!: string;

  @ManyToOne(() => ConsultantSkillExam, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'exam_id',
    foreignKeyConstraintName: 'fk_consultant_skill_scores_to_skill_exams',
  })
  public exam!: ConsultantSkillExam;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  public score!: string;

  @Column({ name: 'calculated_at', type: 'timestamptz' })
  public calculatedAt!: Date;
}
