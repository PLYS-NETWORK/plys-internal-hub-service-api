import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { BillingPeriodStatus } from '@database/enums/billing-period-status.enum';
import { AuditableEntity } from '@database/entities/base/auditable.entity';
import { BusinessProfile } from '@database/entities/profiles/business-profile.entity';

// Monthly window per business. Always create / fetch via the SQL function
// `get_or_create_billing_period(business_id, year, month)` to prevent races
// when two tasks of the same month finalize concurrently.
@Entity('billing_periods')
@Unique('uq_billing_periods_business_period_start', ['businessId', 'periodStart'])
@Check('ck_billing_periods_period_dates_valid', '"period_end" >= "period_start"')
export class BillingPeriod extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_billing_periods' })
  public readonly id!: string;

  @Column({ name: 'business_id', type: 'uuid' })
  public businessId!: string;

  @ManyToOne(() => BusinessProfile, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'business_id',
    foreignKeyConstraintName: 'fk_billing_periods_to_business_profiles',
  })
  public business!: BusinessProfile;

  @Column({ name: 'period_start', type: 'date' })
  public periodStart!: string;

  @Column({ name: 'period_end', type: 'date' })
  public periodEnd!: string;

  @Column({ type: 'varchar', length: 20, default: BillingPeriodStatus.OPEN })
  public status!: BillingPeriodStatus;

  @Column({ name: 'total_amount', type: 'numeric', precision: 12, scale: 2, default: 0 })
  public totalAmount!: string;

  @Column({ name: 'finalized_at', type: 'timestamptz', nullable: true })
  public finalizedAt!: Date | null;
}
