import { TraceableEntity } from '@database/entities/base/traceable.entity';
import { AuthTokenType } from '@database/enums/auth-token-type.enum';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { User } from './user.entity';

// Append-only audit of short-lived credentials. Raw tokens are never stored —
// only their SHA-256 hash. The raw token is sent to the user's email and
// discarded. Consumption marks the row with `used_at`, never deletes it.
@Entity('auth_tokens')
@Unique('uq_auth_tokens_token_hash', ['tokenHash'])
@Index('idx_auth_tokens_user_id', ['userId'])
@Index('idx_auth_tokens_type_expires', ['type', 'expiresAt'])
export class AuthToken extends TraceableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_auth_tokens' })
  public readonly id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  public userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_auth_tokens_to_users' })
  public user!: User;

  @Column({ type: 'varchar', length: 30 })
  public type!: AuthTokenType;

  @Column({ name: 'token_hash', type: 'text' })
  public tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  public expiresAt!: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  public usedAt!: Date | null;
}
