import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { ConsultantAvailability } from '../../enums/consultant-availability.enum';
import { User } from '../auth/user.entity';
import { AuditableEntity } from '../base/auditable.entity';

// One consultant profile per user. `max_concurrent_projects` is enforced by
// a trigger on project_members.INSERT — see Domain 6 migration.
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

  @Column({ type: 'varchar', length: 300, nullable: true })
  public headline!: string | null;

  @Column({ type: 'text', nullable: true })
  public bio!: string | null;

  @Column({ name: 'years_of_experience', type: 'smallint', nullable: true })
  public yearsOfExperience!: number | null;

  @Column({
    name: 'hourly_rate',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  public hourlyRate!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  public availability!: ConsultantAvailability | null;

  // Max simultaneous active project memberships; enforced by DB trigger.
  @Column({ name: 'max_concurrent_projects', type: 'smallint', default: 5 })
  public maxConcurrentProjects!: number;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  public avatarUrl!: string | null;

  @Column({ name: 'address_line1', type: 'varchar', length: 255, nullable: true })
  public addressLine1!: string | null;

  @Column({ name: 'address_line2', type: 'varchar', length: 255, nullable: true })
  public addressLine2!: string | null;

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
}
