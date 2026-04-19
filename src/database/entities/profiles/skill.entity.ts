import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { AuditableEntity } from '@database/entities/base/auditable.entity';

// Normalized skill taxonomy, shared across the platform.
//
// NOTE: `name` holds an i18n key (e.g. `skill_react`), NOT a human-readable
// label. Translation happens at the frontend via src/i18n/<lang>/skill.json.
//
// Case-insensitive uniqueness is enforced at the DB level via a functional
// unique index on LOWER(name) in the domain-2 migration.
@Entity('skills')
export class Skill extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_skills' })
  public readonly id!: string;

  @Column({ type: 'varchar', length: 100 })
  public name!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  public category!: string | null;
}
