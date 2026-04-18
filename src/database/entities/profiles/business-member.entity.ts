import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { BusinessMemberRole } from '../../enums/business-member-role.enum';
import { BusinessMemberStatus } from '../../enums/business-member-status.enum';
import { User } from '../auth/user.entity';
import { AuditableEntity } from '../base/auditable.entity';
import { BusinessProfile } from './business-profile.entity';

// Authoritative membership table for a business. ALL permission checks go
// through this table — never BusinessProfile.user_id directly, which only
// records the founding user.
@Entity('business_members')
@Unique('uq_business_members_business_user', ['businessId', 'userId'])
@Index('idx_business_members_business_id', ['businessId'])
@Index('idx_business_members_user_id', ['userId'])
export class BusinessMember extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_business_members' })
  public readonly id!: string;

  @Column({ name: 'business_id', type: 'uuid' })
  public businessId!: string;

  @ManyToOne(() => BusinessProfile, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'business_id',
    foreignKeyConstraintName: 'fk_business_members_to_business_profiles',
  })
  public business!: BusinessProfile;

  @Column({ name: 'user_id', type: 'uuid' })
  public userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_business_members_to_users',
  })
  public user!: User;

  @Column({ type: 'varchar', length: 20, default: BusinessMemberRole.VIEWER })
  public role!: BusinessMemberRole;

  @Column({ name: 'invited_by', type: 'uuid', nullable: true })
  public invitedBy!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: BusinessMemberStatus.ACTIVE,
  })
  public status!: BusinessMemberStatus;

  @Column({ name: 'joined_at', type: 'timestamptz', default: () => 'NOW()' })
  public joinedAt!: Date;

  @Column({ name: 'left_at', type: 'timestamptz', nullable: true })
  public leftAt!: Date | null;
}
