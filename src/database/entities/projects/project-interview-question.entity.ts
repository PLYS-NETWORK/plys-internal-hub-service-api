import { AuditableEntity } from '@database/entities/base/auditable.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Project } from './project.entity';

@Entity('project_interview_questions')
@Index('idx_project_interview_questions_project_id', ['projectId'])
export class ProjectInterviewQuestion extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_project_interview_questions' })
  public readonly id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  public projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'project_id',
    foreignKeyConstraintName: 'fk_project_interview_questions_to_projects',
  })
  public project!: Project;

  @Column({ name: 'question_text', type: 'text' })
  public questionText!: string;

  @Column({ name: 'display_order', type: 'smallint', default: 1 })
  public displayOrder!: number;

  @Column({ name: 'is_required', type: 'boolean', default: true })
  public isRequired!: boolean;
}
