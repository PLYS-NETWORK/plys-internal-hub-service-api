import {
  Auditable,
  AuditableEntity,
} from '@plys/libraries/database/entities/base/auditable.entity';
import { OnboardingQuestionType } from '@plys/libraries/database/enums';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export interface IOnboardingQuestionOption {
  value: string;
  label: string;
}

@Auditable()
@Entity('onboarding_questions')
@Index('idx_onboarding_questions_is_active', ['isActive'])
export class OnboardingQuestion extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_onboarding_questions' })
  public readonly id!: string;

  @Column({ type: 'varchar', length: 16 })
  public type!: OnboardingQuestionType;

  @Column({ type: 'text' })
  public question!: string;

  // Null for TEXT; required (non-empty array of { value, label }) for RADIO and CHECKBOX.
  @Column({ type: 'jsonb', nullable: true })
  public options!: IOnboardingQuestionOption[] | null;

  // 1..N among rows where is_active=true AND deleted_at IS NULL.
  // Null when the question is inactive — partial unique index enforces uniqueness only on the active set.
  @Column({ type: 'smallint', nullable: true })
  public position!: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  public isActive!: boolean;
}
