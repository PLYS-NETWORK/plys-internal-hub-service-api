import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { AuditableEntity } from '../base/auditable.entity';

// Root identity. One row per human.
// NOTE: email uniqueness is enforced at the DB level via a functional unique index
// on LOWER(email) in the domain-1-indexes migration — NOT a column-level UNIQUE.
// This lets callers look up users by email without worrying about case.
@Entity('users')
export class User extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_users' })
  public readonly id!: string;

  @Column({ type: 'varchar', length: 255 })
  public email!: string;

  @Column({ name: 'password_hash', type: 'text', nullable: true })
  public passwordHash!: string | null;

  @Column({ name: 'is_email_verified', type: 'boolean', default: false })
  public isEmailVerified!: boolean;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  public emailVerifiedAt!: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  public isActive!: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  public lastLoginAt!: Date | null;
}
