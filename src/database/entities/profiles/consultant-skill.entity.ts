import { Traceable, TraceableEntity } from '@database/entities/base/traceable.entity';
import { ProficiencyLevel } from '@database/enums/proficiency-level.enum';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { ConsultantProfile } from './consultant-profile.entity';
import { Skill } from './skill.entity';

// Junction table (composite PK) — extends TraceableEntity (createdAt + createdBy only).
// Full audit (updated*/deleted*) is meaningless for a link row without an identity.
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
    default: ProficiencyLevel.INTERMEDIATE,
  })
  public proficiencyLevel!: ProficiencyLevel;

  @Column({ name: 'years_with_skill', type: 'smallint', nullable: true })
  public yearsWithSkill!: number | null;
}
