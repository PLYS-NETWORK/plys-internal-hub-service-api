import { User } from '@database/entities/auth/user.entity';
import { Auditable, AuditableEntity } from '@database/entities/base/auditable.entity';
import { ConsultantProfile } from '@database/entities/profiles/consultant-profile.entity';
import { Project } from '@database/entities/projects/project.entity';
import { TaskCreationMode } from '@database/enums/task-creation-mode.enum';
import { TaskDifficulty } from '@database/enums/task-difficulty.enum';
import { TaskKanbanStatus } from '@database/enums/task-kanban-status.enum';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  VersionColumn,
} from 'typeorm';

// Atomic unit of work inside a project.
//
// Pricing: `platform_fee_amount` and `consultant_payout` are STORED generated
// columns computed from `price` and `platform_fee_rate` — never write them.
//
// CONCURRENCY (race-free claim): when a consultant claims a task, the service
// layer must run inside a transaction:
//
//   SELECT id FROM tasks
//    WHERE id = $1 AND kanban_status = 'to_do' AND assigned_to IS NULL
//    FOR UPDATE SKIP LOCKED;
//
// then UPDATE in the same transaction.
//
// `@VersionColumn` (§H1 fix) replaces the manual `version` counter — TypeORM
// auto-increments on every save and throws OptimisticLockVersionMismatchError
// on stale updates.
//
// `billing_period_id` FK is added by the Domain 8 migration once
// `billing_periods` exists.
@Auditable()
@Entity('tasks')
@Index('idx_tasks_project_status', ['projectId', 'kanbanStatus'])
@Index('idx_tasks_billing_period', ['billingPeriodId'])
export class Task extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_tasks' })
  public readonly id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  public projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'project_id',
    foreignKeyConstraintName: 'fk_tasks_to_projects',
  })
  public project!: Project;

  @Column({ type: 'varchar', length: 300 })
  public title!: string;

  @Column({ type: 'text', nullable: true })
  public description!: string | null;

  // Pricing (CHECK enforced at migration; see also §H9 — draft tasks may have
  // price = 0 prior to publication, enforced via CHECK constraint).
  @Column({ type: 'numeric', precision: 10, scale: 2 })
  public price!: number;

  @Column({
    name: 'platform_fee_rate',
    type: 'numeric',
    precision: 5,
    scale: 4,
    default: 0.1,
  })
  public platformFeeRate!: number;

  @Column({
    name: 'platform_fee_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    generatedType: 'STORED',
    asExpression: 'ROUND(price * platform_fee_rate, 2)',
    insert: false,
    update: false,
  })
  public readonly platformFeeAmount!: number;

  @Column({
    name: 'consultant_payout',
    type: 'numeric',
    precision: 10,
    scale: 2,
    generatedType: 'STORED',
    asExpression: 'ROUND(price - (price * platform_fee_rate), 2)',
    insert: false,
    update: false,
  })
  public readonly consultantPayout!: number;

  @Column({
    name: 'difficulty_level',
    type: 'varchar',
    length: 20,
    default: TaskDifficulty.MEDIUM,
  })
  public difficultyLevel!: TaskDifficulty;

  @Column({
    name: 'creation_mode',
    type: 'varchar',
    length: 15,
    default: TaskCreationMode.MANUAL,
  })
  public creationMode!: TaskCreationMode;

  @Column({
    name: 'kanban_status',
    type: 'varchar',
    length: 25,
    default: TaskKanbanStatus.DRAFT,
  })
  public kanbanStatus!: TaskKanbanStatus;

  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  public assignedTo!: string | null;

  @ManyToOne(() => ConsultantProfile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'assigned_to',
    foreignKeyConstraintName: 'fk_tasks_to_consultant_profiles',
  })
  public assignee!: ConsultantProfile | null;

  @Column({ name: 'assigned_at', type: 'timestamptz', nullable: true })
  public assignedAt!: Date | null;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  public approvedBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'approved_by',
    foreignKeyConstraintName: 'fk_tasks_approved_by_to_users',
  })
  public approver!: User | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  public approvedAt!: Date | null;

  // FK to billing_periods added in Domain 8 migration.
  @Column({ name: 'billing_period_id', type: 'uuid', nullable: true })
  public billingPeriodId!: string | null;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  public displayOrder!: number;

  // §H1 — TypeORM-managed optimistic lock counter.
  @VersionColumn()
  public readonly version!: number;
}
