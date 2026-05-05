import { User } from '@database/entities/auth/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

// One row per (key, user, endpoint) accepted by IdempotencyInterceptor.
// Lookup hot path is the composite PK; the secondary index on `expires_at`
// drives the housekeeping cron's bulk delete.
//
// `request_hash` is a sha256 hex of the canonical request body — same key +
// same body = cached replay; same key + different body = 409.
@Entity('idempotency_key')
@Index('idx_idempotency_key_expires_at', ['expiresAt'])
export class IdempotencyKey {
  @PrimaryColumn({ type: 'varchar', length: 80 })
  public key!: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  public userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_idempotency_key_to_users',
  })
  public user!: User;

  @PrimaryColumn({ type: 'varchar', length: 120 })
  public endpoint!: string;

  @Column({ name: 'request_hash', type: 'char', length: 64 })
  public requestHash!: string;

  @Column({ name: 'response_status', type: 'smallint' })
  public responseStatus!: number;

  @Column({ name: 'response_body', type: 'jsonb' })
  public responseBody!: unknown;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  public readonly createdAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  public expiresAt!: Date;
}
