import {
  Auditable,
  AuditableEntity,
} from '@plys/libraries/database/entities/base/auditable.entity';
import { ActivePlatform, SsoProvider } from '@plys/libraries/database/enums';
import { encryptedStringTransformer } from '@plys/libraries/database/transformers/encrypted-string.transformer';
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

// OAuth / SSO provider links. Uniqueness is scoped by platform so the same
// Google account may independently link to a Business user and a Consultant
// user (two separate accounts, one per platform). The `platform` column is
// denormalized from the owning user and kept in sync at insert time.
//
// access_token / refresh_token are encrypted at rest via the
// EncryptedStringTransformer (AES-256-GCM, see CryptoVault).
@Auditable()
@Entity('user_sso_providers')
@Unique('uq_user_sso_providers_platform_provider_identity', [
  'platform',
  'provider',
  'providerUserId',
])
@Index('idx_user_sso_providers_user_id', ['userId'])
export class UserSsoProvider extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_user_sso_providers' })
  public readonly id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  public userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_user_sso_providers_to_users',
  })
  public user!: User;

  @Column({ type: 'varchar', length: 20 })
  public platform!: ActivePlatform;

  @Column({ type: 'varchar', length: 50 })
  public provider!: SsoProvider;

  @Column({ name: 'provider_user_id', type: 'varchar', length: 255 })
  public providerUserId!: string;

  @Column({ name: 'provider_email', type: 'varchar', length: 255, nullable: true })
  public providerEmail!: string | null;

  // Encrypted at rest. The transformer handles encrypt-on-write and
  // decrypt-on-read so service code sees plaintext as before.
  @Column({
    name: 'access_token',
    type: 'text',
    nullable: true,
    transformer: encryptedStringTransformer,
  })
  public accessToken!: string | null;

  @Column({
    name: 'refresh_token',
    type: 'text',
    nullable: true,
    transformer: encryptedStringTransformer,
  })
  public refreshToken!: string | null;

  @Column({ name: 'token_expires_at', type: 'timestamptz', nullable: true })
  public tokenExpiresAt!: Date | null;
}
