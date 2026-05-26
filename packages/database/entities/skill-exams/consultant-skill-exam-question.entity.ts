import {
  Traceable,
  TraceableEntity,
} from '@plys/libraries/database/entities/base/traceable.entity';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { ConsultantSkillExam } from './consultant-skill-exam.entity';

@Traceable()
@Entity('consultant_skill_exam_questions')
@Unique('uq_consultant_skill_exam_questions_order', ['examId', 'questionOrder'])
export class ConsultantSkillExamQuestion extends TraceableEntity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_consultant_skill_exam_questions',
  })
  public readonly id!: string;

  @Column({ name: 'exam_id', type: 'uuid' })
  public examId!: string;

  @ManyToOne(() => ConsultantSkillExam, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'exam_id',
    foreignKeyConstraintName: 'fk_consultant_skill_exam_questions_to_exams',
  })
  public exam!: ConsultantSkillExam;

  @Column({ name: 'question_order', type: 'smallint' })
  public questionOrder!: number;

  @Column({ type: 'text' })
  public content!: string;

  @Column({ name: 'expected_answer_hints', type: 'jsonb', nullable: true })
  public expectedAnswerHints!: Record<string, unknown> | null;
}
