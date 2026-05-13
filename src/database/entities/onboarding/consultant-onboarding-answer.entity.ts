import { Auditable, AuditableEntity } from '@database/entities/base/auditable.entity';
import { OnboardingQuestionType } from '@database/enums';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { ConsultantOnboarding } from './consultant-onboarding.entity';
import { IOnboardingQuestionOption, OnboardingQuestion } from './onboarding-question.entity';

// Frozen snapshot of the question at the moment of submission, so admin can review
// even if the admin later edits or soft-deletes the underlying onboarding_question row.
export interface IOnboardingQuestionSnapshot {
  type: OnboardingQuestionType;
  question: string;
  options?: IOnboardingQuestionOption[] | null;
}

// Shape depends on question type:
//   TEXT     -> { text: string }
//   RADIO    -> { value: string }     // matches one of options[].value
//   CHECKBOX -> { values: string[] }  // non-empty subset of options[].value
export type OnboardingAnswerValue = { text: string } | { value: string } | { values: string[] };

@Auditable()
@Entity('consultant_onboarding_answers')
@Unique('uq_consultant_onboarding_answers_onboarding_question', [
  'onboardingId',
  'onboardingQuestionId',
])
export class ConsultantOnboardingAnswer extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_consultant_onboarding_answers' })
  public readonly id!: string;

  @Column({ name: 'onboarding_id', type: 'uuid' })
  public onboardingId!: string;

  @ManyToOne(() => ConsultantOnboarding, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'onboarding_id',
    foreignKeyConstraintName: 'fk_consultant_onboarding_answers_to_onboardings',
  })
  public onboarding!: ConsultantOnboarding;

  @Column({ name: 'onboarding_question_id', type: 'uuid' })
  public onboardingQuestionId!: string;

  @ManyToOne(() => OnboardingQuestion, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'onboarding_question_id',
    foreignKeyConstraintName: 'fk_consultant_onboarding_answers_to_questions',
  })
  public onboardingQuestion!: OnboardingQuestion;

  @Column({ name: 'question_snapshot', type: 'jsonb' })
  public questionSnapshot!: IOnboardingQuestionSnapshot;

  @Column({ name: 'answer_value', type: 'jsonb' })
  public answerValue!: OnboardingAnswerValue;

  @Column({ name: 'submitted_at', type: 'timestamptz' })
  public submittedAt!: Date;
}
