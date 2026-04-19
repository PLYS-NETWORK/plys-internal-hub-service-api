import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { AuditableEntity } from '@database/entities/base/auditable.entity';
import { ConsultantProfile } from '@database/entities/profiles/consultant-profile.entity';

// SCHEMA FIX §C2: cleared_balance does NOT enforce >= 0. The wallet ledger
// can go negative during chargebacks/reversals. Non-negative withdrawal is
// enforced at the application layer (TranslatableException) instead.
//
// Balance columns are managed exclusively by trg_sync_wallet_balance — never
// UPDATE them directly from app code.
@Entity('consultant_wallets')
@Unique('uq_consultant_wallets_consultant_id', ['consultantId'])
export class ConsultantWallet extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_consultant_wallets' })
  public readonly id!: string;

  @Column({ name: 'consultant_id', type: 'uuid' })
  public consultantId!: string;

  @OneToOne(() => ConsultantProfile, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'consultant_id',
    foreignKeyConstraintName: 'fk_consultant_wallets_to_consultant_profiles',
  })
  public consultant!: ConsultantProfile;

  @Column({
    name: 'cleared_balance',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  public readonly clearedBalance!: string;

  @Column({
    name: 'pending_balance',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  public readonly pendingBalance!: string;

  @Column({ type: 'char', length: 3, default: 'USD' })
  public currency!: string;

  @Column({ name: 'total_earned', type: 'numeric', precision: 12, scale: 2, default: 0 })
  public readonly totalEarned!: string;

  @Column({ name: 'total_withdrawn', type: 'numeric', precision: 12, scale: 2, default: 0 })
  public readonly totalWithdrawn!: string;
}
