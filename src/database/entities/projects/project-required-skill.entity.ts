import { TraceableEntity } from '@database/entities/base/traceable.entity';
import { Skill } from '@database/entities/profiles/skill.entity';
import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { Project } from './project.entity';

// Junction (project, skill). Composite PK; TraceableEntity = createdAt + createdBy only.
@Entity('project_required_skills')
@Index('idx_project_required_skills_skill_id', ['skillId'])
export class ProjectRequiredSkill extends TraceableEntity {
  @PrimaryColumn({ name: 'project_id', type: 'uuid' })
  public projectId!: string;

  @PrimaryColumn({ name: 'skill_id', type: 'uuid' })
  public skillId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'project_id',
    foreignKeyConstraintName: 'fk_project_required_skills_to_projects',
  })
  public project!: Project;

  @ManyToOne(() => Skill, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'skill_id',
    foreignKeyConstraintName: 'fk_project_required_skills_to_skills',
  })
  public skill!: Skill;
}
