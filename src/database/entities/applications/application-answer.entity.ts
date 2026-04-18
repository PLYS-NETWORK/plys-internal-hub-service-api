import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { TraceableEntity } from '../base/traceable.entity';
import { ProjectApplication } from './project-application.entity';
import { ScreeningQuestion } from './screening-question.entity';

// `question_text_snapshot` (§H5) preserves the exact wording at submission
// time even if the question is later deleted (only possible while the project
// is unpublished — see lock trigger).
@Entity('application_answers')
@Unique('uq_application_answers_application_question', ['applicationId', 'questionId'])
export class ApplicationAnswer extends TraceableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_application_answers' })
  public readonly id!: string;

  @Column({ name: 'application_id', type: 'uuid' })
  public applicationId!: string;

  @ManyToOne(() => ProjectApplication, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'application_id',
    foreignKeyConstraintName: 'fk_application_answers_to_project_applications',
  })
  public application!: ProjectApplication;

  @Column({ name: 'question_id', type: 'uuid' })
  public questionId!: string;

  @ManyToOne(() => ScreeningQuestion, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'question_id',
    foreignKeyConstraintName: 'fk_application_answers_to_screening_questions',
  })
  public question!: ScreeningQuestion;

  @Column({ name: 'question_text_snapshot', type: 'text' })
  public questionTextSnapshot!: string;

  @Column({ name: 'answer_text', type: 'text', nullable: true })
  public answerText!: string | null;
}
