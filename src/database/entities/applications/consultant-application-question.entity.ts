import { ConsultantApplication } from '@database/entities/applications/consultant-application.entity';
import { InterviewQuestion } from '@database/entities/applications/interview-question.entity';
import { Traceable, TraceableEntity } from '@database/entities/base/traceable.entity';
import { QuestionType } from '@database/enums';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Traceable()
@Entity('consultant_application_questions')
@Unique('uq_consultant_application_questions_app_order', ['applicationId', 'questionOrder'])
@Index('idx_consultant_application_questions_application_id', ['applicationId'])
export class ConsultantApplicationQuestion extends TraceableEntity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_consultant_application_questions',
  })
  public readonly id!: string;

  @Column({ name: 'application_id', type: 'uuid' })
  public applicationId!: string;

  @ManyToOne(() => ConsultantApplication, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'application_id',
    foreignKeyConstraintName: 'fk_consultant_application_questions_to_applications',
  })
  public application!: ConsultantApplication;

  @Column({ name: 'question_id', type: 'uuid' })
  public questionId!: string;

  @ManyToOne(() => InterviewQuestion, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'question_id',
    foreignKeyConstraintName: 'fk_consultant_application_questions_to_questions',
  })
  public question!: InterviewQuestion;

  @Column({ name: 'content_snapshot', type: 'text' })
  public contentSnapshot!: string;

  @Column({ type: 'varchar', length: 20 })
  public type!: QuestionType;

  @Column({ name: 'skill_id', type: 'uuid', nullable: true })
  public skillId!: string | null;

  @Column({ name: 'question_order', type: 'smallint' })
  public questionOrder!: number;
}
