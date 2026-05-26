import {
  Auditable,
  AuditableEntity,
} from '@plys/libraries/database/entities/base/auditable.entity';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { ConsultantSkillExamQuestion } from './consultant-skill-exam-question.entity';

@Auditable()
@Entity('consultant_skill_exam_answers')
@Unique('uq_consultant_skill_exam_answers_question', ['examQuestionId'])
export class ConsultantSkillExamAnswer extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_consultant_skill_exam_answers',
  })
  public readonly id!: string;

  @Column({ name: 'exam_question_id', type: 'uuid' })
  public examQuestionId!: string;

  @ManyToOne(() => ConsultantSkillExamQuestion, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'exam_question_id',
    foreignKeyConstraintName: 'fk_consultant_skill_exam_answers_to_questions',
  })
  public examQuestion!: ConsultantSkillExamQuestion;

  @Column({ name: 'answer_text', type: 'text' })
  public answerText!: string;

  @Column({ name: 'submitted_at', type: 'timestamptz' })
  public submittedAt!: Date;

  @Column({
    name: 'copyleaks_ai_score',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  public copyleaksAiScore!: string | null;

  @Column({
    name: 'ai_eval_score',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  public aiEvalScore!: string | null;

  @Column({ name: 'is_correct', type: 'boolean', nullable: true })
  public isCorrect!: boolean | null;

  @Column({ name: 'ai_feedback', type: 'text', nullable: true })
  public aiFeedback!: string | null;
}
