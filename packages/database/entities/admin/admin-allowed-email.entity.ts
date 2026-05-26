import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { UserRole } from '../../enums/auth/user-role.enum';

@Entity('admin_allowed_emails')
@Unique('uq_admin_allowed_emails_email', ['email'])
@Index('idx_admin_allowed_emails_email', ['email'])
export class AdminAllowedEmail {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_admin_allowed_emails' })
  public readonly id!: string;

  @Column({ name: 'email', type: 'varchar', length: 255 })
  public email!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  public isActive!: boolean;

  // Determines which role the auto-provisioned user gets at first OTP login.
  // Limited to admin-platform roles: ADMIN_PLATFORM or TASK_REVIEWER.
  @Column({ name: 'role', type: 'varchar', length: 20, default: UserRole.ADMIN_PLATFORM })
  public role!: UserRole;

  // Nullable: first entry may be seeded without an existing admin user.
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  public createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  public readonly createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  public updatedAt!: Date;
}
