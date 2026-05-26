import {
  Traceable,
  TraceableEntity,
} from '@plys/libraries/database/entities/base/traceable.entity';
import { ProficiencyLevel } from '@plys/libraries/database/enums';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { ConsultantProfile } from './consultant-profile.entity';
import { Skill } from './skill.entity';

// Junction table (composite PK) — extends TraceableEntity (createdAt + createdBy only).
// `proficiency_level` and `rating` are system-assigned by the skill-exam pipeline:
// rating is the % score (0–100) from the latest passing exam; proficiency is
// derived from rating (80–89 → advanced, ≥90 → expert).
@Traceable()
@Entity('consultant_skills')
@Index('idx_consultant_skills_skill_id', ['skillId'])
export class ConsultantSkill extends TraceableEntity {
  @PrimaryColumn({ name: 'consultant_id', type: 'uuid' })
  public consultantId!: string;

  @PrimaryColumn({ name: 'skill_id', type: 'uuid' })
  public skillId!: string;

  @ManyToOne(() => ConsultantProfile, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'consultant_id',
    foreignKeyConstraintName: 'fk_consultant_skills_to_consultant_profiles',
  })
  public consultant!: ConsultantProfile;

  @ManyToOne(() => Skill, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'skill_id',
    foreignKeyConstraintName: 'fk_consultant_skills_to_skills',
  })
  public skill!: Skill;

  @Column({
    name: 'proficiency_level',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  public proficiencyLevel!: ProficiencyLevel | null;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  public rating!: string | null;
}
