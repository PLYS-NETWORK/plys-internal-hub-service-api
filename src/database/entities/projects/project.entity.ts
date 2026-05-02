import { Auditable, AuditableEntity } from '@database/entities/base/auditable.entity';
import { BusinessProfile } from '@database/entities/profiles/business-profile.entity';
import { ProjectPaymentType, ProjectStatus } from '@database/enums';
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
// Drives the consultant discovery query (status = 'PUBLIC' ORDER BY published_at DESC).
// A composite index avoids a sort step on the filtered set.
@Index('idx_projects_status_published_at', ['status', 'publishedAt'])
// Consultant overview/list endpoints branch on payment_type — keep it indexed.
@Index('idx_projects_payment_type', ['paymentType'])
@Index('uq_projects_business_code', ['businessId', 'code'], { unique: true })
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

  // Human-readable identifier scoped to the business (uppercase A-Z/0-9, 2-8 chars).
  // Used as the prefix for task codes ([code]-[N]). Unique within business_id.
  @Column({ type: 'varchar', length: 8 })
  public code!: string;

  @Column({ type: 'varchar', length: 300 })
  public title!: string;

  @Column({ type: 'jsonb', nullable: true })
  public introduction!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 20, default: ProjectStatus.DRAFT })
  public status!: ProjectStatus;

  // Drives consultant overview branching (per-task vs per-month payouts) and
  // whether avg_price_per_task is meaningful in the discovery list.
  @Column({
    name: 'payment_type',
    type: 'varchar',
    length: 20,
    default: ProjectPaymentType.PER_TASK,
  })
  public paymentType!: ProjectPaymentType;

  @Column({ name: 'required_consultants', type: 'smallint', default: 0 })
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
