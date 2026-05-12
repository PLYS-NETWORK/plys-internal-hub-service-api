import { Auditable, AuditableEntity } from '@database/entities/base/auditable.entity';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { ConsultantOnboardingQuestion } from './consultant-onboarding-question.entity';

@Auditable()
@Entity('consultant_onboarding_answers')
@Unique('uq_consultant_onboarding_answers_question', ['onboardingQuestionId'])
export class ConsultantOnboardingAnswer extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_consultant_onboarding_answers' })
  public readonly id!: string;

  @Column({ name: 'onboarding_question_id', type: 'uuid' })
  public onboardingQuestionId!: string;

  @ManyToOne(() => ConsultantOnboardingQuestion, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'onboarding_question_id',
    foreignKeyConstraintName: 'fk_consultant_onboarding_answers_to_questions',
  })
  public onboardingQuestion!: ConsultantOnboardingQuestion;

  @Column({ name: 'answer_text', type: 'text' })
  public answerText!: string;

  @Column({ name: 'submitted_at', type: 'timestamptz' })
  public submittedAt!: Date;
}
