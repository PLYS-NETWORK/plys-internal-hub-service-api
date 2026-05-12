import { InterviewQuestion } from '@database/entities/applications/interview-question.entity';
import { Traceable, TraceableEntity } from '@database/entities/base/traceable.entity';
import { QuestionType } from '@database/enums';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { ConsultantOnboarding } from './consultant-onboarding.entity';

@Traceable()
@Entity('consultant_onboarding_questions')
@Unique('uq_consultant_onboarding_questions_order', ['onboardingId', 'questionOrder'])
export class ConsultantOnboardingQuestion extends TraceableEntity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_consultant_onboarding_questions',
  })
  public readonly id!: string;

  @Column({ name: 'onboarding_id', type: 'uuid' })
  public onboardingId!: string;

  @ManyToOne(() => ConsultantOnboarding, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'onboarding_id',
    foreignKeyConstraintName: 'fk_consultant_onboarding_questions_to_onboardings',
  })
  public onboarding!: ConsultantOnboarding;

  @Column({ name: 'interview_question_id', type: 'uuid' })
  public interviewQuestionId!: string;

  @ManyToOne(() => InterviewQuestion, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'interview_question_id',
    foreignKeyConstraintName: 'fk_consultant_onboarding_questions_to_interview_questions',
  })
  public interviewQuestion!: InterviewQuestion;

  @Column({ type: 'varchar', length: 20 })
  public type!: QuestionType;

  @Column({ name: 'content_snapshot', type: 'text' })
  public contentSnapshot!: string;

  @Column({ name: 'question_order', type: 'smallint' })
  public questionOrder!: number;
}
