import { Auditable, AuditableEntity } from '@database/entities/base/auditable.entity';
import { BusinessProfile } from '@database/entities/profiles/business-profile.entity';
import { ProjectStatus } from '@database/enums';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

// Top-level project owned by a business.
//
// IMPORTANT: status transitions and hiring_mode are enforced by DB triggers
// (see Domain 3 migration). Application code should NOT validate transitions
// itself — let the DB raise so behaviour is consistent across services.
@Auditable()
@Entity('projects')
@Index('idx_projects_business_id', ['businessId'])
@Index('idx_projects_status', ['status'])
export class Project extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_projects' })
  public readonly id!: string;

  @Column({ name: 'business_id', type: 'uuid' })
  public businessId!: string;

  @ManyToOne(() => BusinessProfile, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'business_id',
    foreignKeyConstraintName: 'fk_projects_to_business_profiles',
  })
  public business!: BusinessProfile;

  @Column({ type: 'varchar', length: 300 })
  public title!: string;

  @Column({ type: 'text', nullable: true })
  public introduction!: string | null;

  @Column({ type: 'varchar', length: 20, default: ProjectStatus.DRAFT })
  public status!: ProjectStatus;

  @Column({ name: 'required_consultants', type: 'smallint', default: 1 })
  public requiredConsultants!: number;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  public publishedAt!: Date | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  public startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  public completedAt!: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  public cancelledAt!: Date | null;
}
