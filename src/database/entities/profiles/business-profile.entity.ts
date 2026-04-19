import { User } from '@database/entities/auth/user.entity';
import { AuditableEntity } from '@database/entities/base/auditable.entity';
import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

// One business profile per user. The creating user is automatically the
// `owner` in business_members — that table is the authoritative source for
// permission checks, never business_profiles.user_id.
@Entity('business_profiles')
@Unique('uq_business_profiles_user_id', ['userId'])
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

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  public logoUrl!: string | null;

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  public isVerified!: boolean;

  @Column({ name: 'is_partner_platform', type: 'boolean', default: false })
  public isPartnerPlatform!: boolean;

  @Column({ name: 'allow_payment_credit', type: 'boolean', default: false })
  public allowPaymentCredit!: boolean;
}
