import { Auditable, AuditableEntity } from '@database/entities/base/auditable.entity';
import { ActivePlatform, BanReason, UserRole } from '@database/enums';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Root identity. One row per (human, platform) — the same email may exist once
// per platform, producing independent accounts on Business / Consultant / Admin.
//
// Email uniqueness is enforced at the DB level via a functional unique index on
// (platform, LOWER(email)) — defined below with synchronize:false so TypeORM
// emits the expression form. Never rely on a column-level UNIQUE.
@Auditable()
@Entity('users')
@Index('uq_users_platform_email_lower', { synchronize: false })
export class User extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_users' })
  public readonly id!: string;

  @Column({ type: 'varchar', length: 255 })
  public email!: string;

  // Immutable after creation. Determines which side of the marketplace this
  // identity lives on; every downstream lookup (login, SSO, profile) is scoped
  // by this column together with email.
  @Column({ type: 'varchar', length: 20 })
  public platform!: ActivePlatform;

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

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  public role!: UserRole;

  @Column({ name: 'ai_strike_count', type: 'smallint', default: 0 })
  public aiStrikeCount!: number;

  @Column({ name: 'banned_at', type: 'timestamptz', nullable: true })
  public bannedAt!: Date | null;

  @Column({ name: 'ban_reason', type: 'varchar', length: 30, nullable: true })
  public banReason!: BanReason | null;
}
