import { User } from '@plys/libraries/database/entities/auth/user.entity';
import { AiAssistantType, AiProvider } from '@plys/libraries/database/enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Admin-managed model API key. Plaintext is never stored — `key_ciphertext`
// is base64( iv || tag || AES-256-GCM(plaintext, AI_KEYS_MASTER_KEY_v<N>) )
// where `master_key_version` selects which env-supplied master key to use for
// decryption (versioned for zero-downtime rotation).
//
// At most one active key per assistant_type — enforced at the migration
// layer via a partial unique index
// `uq_ai_provider_api_key_active_per_assistant_type` on
// `assistant_type WHERE is_active = true`. The `@Index` decorator can't
// express that predicate, so it lives in SQL.
@Entity('ai_provider_api_key')
@Index('idx_ai_provider_api_key_provider', ['provider'])
@Index('idx_ai_provider_api_key_assistant_type', ['assistantType'])
export class AiProviderApiKey {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_ai_provider_api_key' })
  public readonly id!: string;

  // Which assistant feature this key powers. Acts as the active-key partition
  // (one active row per type, regardless of provider).
  @Column({ name: 'assistant_type', type: 'varchar', length: 20 })
  public assistantType!: AiAssistantType;

  @Column({ type: 'varchar', length: 20 })
  public provider!: AiProvider;

  // The model identifier the FE BFF passes verbatim to the provider SDK.
  // (e.g. 'llama-3.3-70b-versatile' for Groq, 'gemini-2.5-flash' for Google).
  @Column({ type: 'varchar', length: 80 })
  public model!: string;

  // Human-readable identifier — never the plaintext key. Surfaces in admin
  // UIs and audit logs.
  @Column({ type: 'varchar', length: 80 })
  public label!: string;

  @Column({
    name: 'master_key_version',
    type: 'smallint',
  })
  public masterKeyVersion!: number;

  @Column({ name: 'key_ciphertext', type: 'text' })
  public keyCiphertext!: string;

  // Last four characters of the plaintext, retained so admin list views can
  // display `gsk_***...8c2f` style masking without ever round-tripping the
  // ciphertext through the decrypt path.
  @Column({ name: 'key_last4', type: 'char', length: 4 })
  public keyLast4!: string;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  public isActive!: boolean;

  @Column({ name: 'created_by', type: 'uuid' })
  public createdBy!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'created_by',
    foreignKeyConstraintName: 'fk_ai_provider_api_key_to_users',
  })
  public creator!: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  public readonly createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  public readonly updatedAt!: Date;
}
