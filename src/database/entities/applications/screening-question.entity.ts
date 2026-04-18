import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { ScreeningQuestionType } from '../../enums/screening-question-type.enum';
import { AuditableEntity } from '../base/auditable.entity';
import { Project } from '../projects/project.entity';

// Locked at the DB level once the project is published (§H5 + §C6 race-fix).
// See trg_lock_screening_questions_* in Domain 6 migration.
@Entity('screening_questions')
export class ScreeningQuestion extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_screening_questions' })
  public readonly id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  public projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'project_id',
    foreignKeyConstraintName: 'fk_screening_questions_to_projects',
  })
  public project!: Project;

  @Column({ name: 'question_text', type: 'text' })
  public questionText!: string;

  @Column({
    name: 'question_type',
    type: 'varchar',
    length: 20,
    default: ScreeningQuestionType.TEXT,
  })
  public questionType!: ScreeningQuestionType;

  @Column({ name: 'is_required', type: 'boolean', default: true })
  public isRequired!: boolean;

  @Column({ name: 'display_order', type: 'smallint', default: 0 })
  public displayOrder!: number;
}
