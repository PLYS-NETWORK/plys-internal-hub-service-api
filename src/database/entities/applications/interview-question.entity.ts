import { Auditable, AuditableEntity } from '@database/entities/base/auditable.entity';
import { Skill } from '@database/entities/profiles/skill.entity';
import { QuestionType } from '@database/enums';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Auditable()
@Entity('interview_questions')
@Index('idx_interview_questions_type', ['type'])
@Index('idx_interview_questions_skill_id', ['skillId'])
export class InterviewQuestion extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_interview_questions' })
  public readonly id!: string;

  @Column({ type: 'varchar', length: 20 })
  public type!: QuestionType;

  @Column({ type: 'text' })
  public content!: string;

  @Column({ name: 'skill_id', type: 'uuid', nullable: true })
  public skillId!: string | null;

  @ManyToOne(() => Skill, { nullable: true })
  @JoinColumn({
    name: 'skill_id',
    foreignKeyConstraintName: 'fk_interview_questions_to_skills',
  })
  public skill!: Skill | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  public isActive!: boolean;

  @Column({ name: 'display_order', type: 'smallint', nullable: true })
  public displayOrder!: number | null;
}
