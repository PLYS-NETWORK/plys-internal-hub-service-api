import { User } from '@plys/libraries/database/entities/auth/user.entity';
import {
  Auditable,
  AuditableEntity,
} from '@plys/libraries/database/entities/base/auditable.entity';
import { ConsultantProfile } from '@plys/libraries/database/entities/profiles/consultant-profile.entity';
import { Project } from '@plys/libraries/database/entities/projects/project.entity';
import { TaskCreationMode, TaskKanbanStatus } from '@plys/libraries/database/enums';
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
// Replaces the older idx_tasks_project_status — strict superset, removes the
// Sort step from the board's `ORDER BY display_order ASC` listing query.
@Index('idx_tasks_project_status_order', ['projectId', 'kanbanStatus', 'displayOrder'])
@Index('idx_tasks_billing_period', ['billingPeriodId'])
@Index('idx_tasks_due_date', ['dueDate'])
@Index('idx_tasks_started_at', ['startedAt'])
@Index('idx_tasks_completed_at', ['completedAt'])
@Index('idx_tasks_code', ['code'])
@Index('uq_tasks_project_code_seq', ['projectId', 'codeSeq'], { unique: true })
export class Task extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_tasks' })
  public readonly id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  public projectId!: string;

  // Human-readable identifier of the form `<projects.code>-<code_seq>`
  // (e.g. `WEB-1`). Stored denormalized so it survives a project rename and
  // so it can be indexed for direct lookups.
  @Column({ type: 'varchar', length: 20 })
  public code!: string;

  // Per-project monotonically-increasing counter — never reused even after a
  // task is soft-deleted. Source of truth for `code` formatting; allocated
  // via TaskCodeService inside a transaction with pg_advisory_xact_lock.
  @Column({ name: 'code_seq', type: 'int' })
  public codeSeq!: number;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'project_id',
    foreignKeyConstraintName: 'fk_tasks_to_projects',
  })
  public project!: Project;

  @Column({ type: 'varchar', length: 300 })
  public title!: string;

  @Column({ type: 'jsonb', nullable: true })
  public description!: Record<string, unknown> | null;

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

  // Optional deadline used by dashboard "overdue" reporting.
  // A task is overdue when due_date < now() AND kanban_status NOT IN ('done', 'cancelled').
  @Column({ name: 'due_date', type: 'timestamptz', nullable: true })
  public dueDate!: Date | null;

  // FK to billing_periods added in Domain 8 migration.
  @Column({ name: 'billing_period_id', type: 'uuid', nullable: true })
  public billingPeriodId!: string | null;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  public displayOrder!: number;

  // First time the task entered IN_PROGRESS — populated by the consultant-side
  // status-transition handler. Never reset on subsequent transitions so that
  // `total_worked = completed_at - started_at` covers the full lifetime of the
  // task even when it round-trips through REVISION_REQUESTED.
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  public startedAt!: Date | null;

  // Most recent transition into DONE. Cleared when the task is moved out of
  // DONE (e.g. revision requested) so the next completion measures fresh.
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  public completedAt!: Date | null;

  // Total number of times the task has bounced back to REVISION_REQUESTED.
  // Hard-capped at 3; the next failure escalates to a TaskDispute instead of
  // returning to REVISION_REQUESTED.
  @Column({ name: 'revision_count', type: 'int', default: 0 })
  public revisionCount!: number;

  // Current review round; incremented every time the task is (re)submitted
  // for review. Used to scope task_reviews rows so the same reviewer can be
  // assigned again on a later round without violating the uniqueness rule.
  @Column({ name: 'last_review_round', type: 'int', default: 0 })
  public lastReviewRound!: number;

  // §H1 — TypeORM-managed optimistic lock counter.
  @VersionColumn()
  public readonly version!: number;
}
