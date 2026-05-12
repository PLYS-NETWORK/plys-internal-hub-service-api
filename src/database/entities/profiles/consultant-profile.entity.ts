import { User } from '@database/entities/auth/user.entity';
import { Auditable, AuditableEntity } from '@database/entities/base/auditable.entity';
import { ConsultantAvailability } from '@database/enums';
import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

// One consultant profile per user. `max_concurrent_projects` is enforced by
// a trigger on project_members.INSERT — see Domain 6 migration.
@Auditable()
@Entity('consultant_profiles')
@Unique('uq_consultant_profiles_user_id', ['userId'])
export class ConsultantProfile extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_consultant_profiles' })
  public readonly id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  public userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_consultant_profiles_to_users',
  })
  public user!: User;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  public fullName!: string;

  @Column({ type: 'text', nullable: true })
  public bio!: string | null;

  @Column({ name: 'years_of_experience', type: 'smallint', nullable: true })
  public yearsOfExperience!: number | null;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  public availability!: ConsultantAvailability | null;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  public avatarUrl!: string | null;

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

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  public isVerified!: boolean;

  @Column({ name: 'account_balance', type: 'numeric', precision: 15, scale: 2, default: 0 })
  public accountBalance!: string;

  @Column({
    name: 'stripe_connect_account_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  public stripeConnectAccountId!: string | null;

  @Column({ name: 'cv_url', type: 'text', nullable: true })
  public cvUrl!: string | null;

  @Column({ name: 'has_notification_priority', type: 'boolean', default: false })
  public hasNotificationPriority!: boolean;

  @Column({
    name: 'avg_rating',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  public avgRating!: string | null;
}
