import { User } from '@database/entities/auth/user.entity';
import { Auditable, AuditableEntity } from '@database/entities/base/auditable.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

// One business profile per user. The creating user is automatically the
// `owner` in business_members — that table is the authoritative source for
// permission checks, never business_profiles.user_id.
@Auditable()
@Entity('business_profiles')
@Unique('uq_business_profiles_user_id', ['userId'])
// Tax-ID uniqueness is per-platform + country, enforced at the app layer (the
// users.platform + users.is_active filters live outside this table). This is
// just a lookup index to keep that check cheap.
@Index('idx_business_profiles_tax_id_country', ['taxId', 'countryCode'])
export class BusinessProfile extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_business_profiles' })
  public readonly id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  public userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_business_profiles_to_users',
  })
  public user!: User;

  @Column({ name: 'company_name', type: 'varchar', length: 255 })
  public companyName!: string;

  // Captured from `full_name` at registration. Required at the API layer for
  // new sign-ups; nullable in the DB so legacy rows (pre-introduction) remain
  // valid until they re-onboard.
  @Column({ name: 'owner_name', type: 'varchar', length: 255, nullable: true })
  public ownerName!: string | null;

  // Required at the API layer for new onboardings; nullable in the DB so
  // legacy rows (pre-introduction) remain valid until they re-onboard.
  // Uniqueness is enforced in BusinessProfileRepository.existsTaxIdConflict —
  // see idx_business_profiles_tax_id_country above.
  @Column({ name: 'tax_id', type: 'varchar', length: 32, nullable: true })
  public taxId!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  public industry!: string | null;

  @Column({ name: 'company_size', type: 'varchar', length: 50, nullable: true })
  public companySize!: string | null;

  @Column({ name: 'website_url', type: 'varchar', length: 500, nullable: true })
  public websiteUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  public description!: string | null;

  @Column({ name: 'address_line', type: 'varchar', length: 255, nullable: true })
  public addressLine!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  public city!: string | null;

  @Column({ name: 'state_province', type: 'varchar', length: 100, nullable: true })
  public stateProvince!: string | null;

  @Column({ name: 'postal_code', type: 'varchar', length: 20, nullable: true })
  public postalCode!: string | null;

  @Column({ name: 'country_code', type: 'char', length: 2, nullable: true })
  public countryCode!: string | null;

  @Column({ name: 'phone_number', type: 'varchar', length: 30, nullable: true })
  public phoneNumber!: string | null;

  // IANA timezone (e.g. 'Asia/Bangkok'). Set on onboarding from the
  // x-timezone header; mutable via update-profile API. Falls back to the
  // request header (then 'UTC') when null.
  @Column({ name: 'timezone', type: 'varchar', length: 64, nullable: true })
  public timezone!: string | null;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  public logoUrl!: string | null;

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  public isVerified!: boolean;

  @Column({ name: 'is_partner_platform', type: 'boolean', default: false })
  public isPartnerPlatform!: boolean;

  @Column({ name: 'allow_payment_credit', type: 'boolean', default: false })
  public allowPaymentCredit!: boolean;

  @Column({ name: 'account_balance', type: 'numeric', precision: 15, scale: 2, default: 0 })
  public accountBalance!: string;

  @Column({ name: 'stripe_connect_account_id', type: 'varchar', length: 255, nullable: true })
  public stripeConnectAccountId!: string | null;

  /**
   * Platform commission rate applied to this business's monthly invoices (e.g. 0.25 = 25%).
   * Stored per business so different tiers or partner rates can be configured independently.
   * Default 0.25 matches the original hardcoded rate.
   */
  @Column({
    name: 'commission_rate',
    type: 'numeric',
    precision: 5,
    scale: 4,
    default: 0.25,
  })
  public commissionRate!: string;
}
