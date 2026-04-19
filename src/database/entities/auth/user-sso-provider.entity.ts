import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { SsoProvider } from '@database/enums/sso-provider.enum';
import { AuditableEntity } from '@database/entities/base/auditable.entity';
import { User } from './user.entity';

// OAuth / SSO provider links. A single user can have multiple providers
// linked (Google + LinkedIn, etc.), but the pair (provider, provider_user_id)
// must be globally unique so the same Google account can't link to two users.
//
// SECURITY: access_token and refresh_token must be encrypted at rest.
// Current implementation stores plaintext with a TODO — see schema fix §H8.
// Replace with pgcrypto (`pgp_sym_encrypt` wrapper) or external secret store.
@Entity('user_sso_providers')
@Unique('uq_user_sso_providers_provider_identity', ['provider', 'providerUserId'])
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

  @Column({ type: 'varchar', length: 50 })
  public provider!: SsoProvider;

  @Column({ name: 'provider_user_id', type: 'varchar', length: 255 })
  public providerUserId!: string;

  @Column({ name: 'provider_email', type: 'varchar', length: 255, nullable: true })
  public providerEmail!: string | null;

  // TODO §H8: encrypt before persist / decrypt on read.
  @Column({ name: 'access_token', type: 'text', nullable: true })
  public accessToken!: string | null;

  @Column({ name: 'refresh_token', type: 'text', nullable: true })
  public refreshToken!: string | null;

  @Column({ name: 'token_expires_at', type: 'timestamptz', nullable: true })
  public tokenExpiresAt!: Date | null;
}
