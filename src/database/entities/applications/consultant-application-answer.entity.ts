import { ConsultantApplicationQuestion } from '@database/entities/applications/consultant-application-question.entity';
import { Auditable, AuditableEntity } from '@database/entities/base/auditable.entity';
import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Auditable()
@Entity('consultant_application_answers')
@Unique('uq_consultant_application_answers_question', ['applicationQuestionId'])
export class ConsultantApplicationAnswer extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_consultant_application_answers',
  })
  public readonly id!: string;

  @Column({ name: 'application_question_id', type: 'uuid' })
  public applicationQuestionId!: string;

  @OneToOne(() => ConsultantApplicationQuestion, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'application_question_id',
    foreignKeyConstraintName: 'fk_consultant_application_answers_to_questions',
  })
  public applicationQuestion!: ConsultantApplicationQuestion;

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

  @Column({ name: 'ai_feedback', type: 'text', nullable: true })
  public aiFeedback!: string | null;

  @Column({
    name: 'admin_score',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  public adminScore!: string | null;

  @Column({ name: 'admin_notes', type: 'text', nullable: true })
  public adminNotes!: string | null;
}
