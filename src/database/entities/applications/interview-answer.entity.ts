import { TraceableEntity } from '@database/entities/base/traceable.entity';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { ProjectInterviewQuestion } from '../projects/project-interview-question.entity';
import { ProjectApplication } from './project-application.entity';

// Stores a consultant's answer to a project interview question.
// `question_text_snapshot` preserves the exact wording at submission time,
// mirroring the pattern used by ApplicationAnswer for ScreeningQuestion.
@Entity('interview_answers')
@Unique('uq_interview_answers_application_question', ['applicationId', 'questionId'])
export class InterviewAnswer extends TraceableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_interview_answers' })
  public readonly id!: string;

  @Column({ name: 'application_id', type: 'uuid' })
  public applicationId!: string;

  @ManyToOne(() => ProjectApplication, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'application_id',
    foreignKeyConstraintName: 'fk_interview_answers_to_project_applications',
  })
  public application!: ProjectApplication;

  @Column({ name: 'question_id', type: 'uuid' })
  public questionId!: string;

  @ManyToOne(() => ProjectInterviewQuestion, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'question_id',
    foreignKeyConstraintName: 'fk_interview_answers_to_project_interview_questions',
  })
  public question!: ProjectInterviewQuestion;

  @Column({ name: 'question_text_snapshot', type: 'text' })
  public questionTextSnapshot!: string;

  @Column({ name: 'answer_text', type: 'text' })
  public answerText!: string;
}
