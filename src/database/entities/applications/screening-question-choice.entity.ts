import { TraceableEntity } from '@database/entities/base/traceable.entity';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { ScreeningQuestion } from './screening-question.entity';

@Entity('screening_question_choices')
export class ScreeningQuestionChoice extends TraceableEntity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_screening_question_choices',
  })
  public readonly id!: string;

  @Column({ name: 'question_id', type: 'uuid' })
  public questionId!: string;

  @ManyToOne(() => ScreeningQuestion, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'question_id',
    foreignKeyConstraintName: 'fk_screening_question_choices_to_screening_questions',
  })
  public question!: ScreeningQuestion;

  @Column({ name: 'choice_text', type: 'varchar', length: 300 })
  public choiceText!: string;

  @Column({ name: 'display_order', type: 'smallint', default: 0 })
  public displayOrder!: number;
}
