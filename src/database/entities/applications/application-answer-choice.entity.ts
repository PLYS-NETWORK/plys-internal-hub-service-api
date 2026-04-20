import { TraceableEntity } from '@database/entities/base/traceable.entity';
import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { ApplicationAnswer } from './application-answer.entity';
import { ScreeningQuestionChoice } from './screening-question-choice.entity';

@Entity('application_answer_choices')
export class ApplicationAnswerChoice extends TraceableEntity {
  @PrimaryColumn({ name: 'answer_id', type: 'uuid' })
  public answerId!: string;

  @PrimaryColumn({ name: 'choice_id', type: 'uuid' })
  public choiceId!: string;

  @ManyToOne(() => ApplicationAnswer, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'answer_id',
    foreignKeyConstraintName: 'fk_application_answer_choices_to_application_answers',
  })
  public answer!: ApplicationAnswer;

  @ManyToOne(() => ScreeningQuestionChoice, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'choice_id',
    foreignKeyConstraintName: 'fk_application_answer_choices_to_screening_question_choices',
  })
  public choice!: ScreeningQuestionChoice;
}
