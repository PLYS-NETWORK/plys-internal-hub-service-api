import { Auditable, AuditableEntity } from '@database/entities/base/auditable.entity';
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

// One row per active browser/device session. The session token is an opaque
// secret stored in an HTTP-only cookie. The owning user's platform is read
// from `user.platform` on refresh — no denormalized copy lives here.
@Auditable()
@Entity('user_sessions')
@Unique('uq_user_sessions_session_token', ['sessionToken'])
@Index('idx_user_sessions_user_id', ['userId'])
@Index('idx_user_sessions_expires_at', ['expiresAt'])
@Index('idx_user_sessions_device_id', ['deviceId'])
// Drives the active-only lookup in refresh: WHERE session_token = ? AND used_at IS NULL.
@Index('idx_user_sessions_token_used_at', ['sessionToken', 'usedAt'])
export class UserSession extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_user_sessions' })
  public readonly id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  public userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_user_sessions_to_users',
  })
  public user!: User;

  @Column({ name: 'session_token', type: 'text' })
  public sessionToken!: string;

  @Column({ name: 'device_id', type: 'varchar', length: 255, nullable: true })
  public deviceId!: string | null;

  @Column({ name: 'fingerprint', type: 'text', nullable: true })
  public fingerprint!: string | null;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  public ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  public userAgent!: string | null;

  // IANA timezone name captured at session creation (login DTO field or x-timezone
  // header). Echoed back into every JWT issued for this session via the `tz` claim,
  // so RequestContextService can render datetimes in the consultant's local time.
  // Null means we never received a tz — callers default to Etc/UTC.
  @Column({ type: 'varchar', length: 64, nullable: true })
  public timezone!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  public expiresAt!: Date;

  // Single-use marker for refresh-token rotation. Stamped when the session is
  // consumed (logout / refresh), so a replayed refresh token cannot succeed.
  // A row found with `usedAt IS NOT NULL` is a strong signal of token reuse.
  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  public usedAt!: Date | null;
}
