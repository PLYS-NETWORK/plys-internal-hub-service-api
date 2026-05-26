import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Project } from './project.entity';

// Persistent per-project AI memory. Lazily created the first time a chat
// session opens for a project. The BE never derives the AI fields itself —
// `domain`, `primary_stack`, `conventions`, `*_summary`, and per-task
// `summary` strings are written by the FE via PATCH /ai-context/derived.
//
// `task_index` is a compact, BE-maintained projection of the project's tasks
// (one entry per task) kept in sync via BacklogsService hooks. `needs_reindex`
// is the FE's signal to re-derive the AI fields and write them back; flipped
// on by task / skill / status mutations and by the flag-projects-for-reindex
// cron after 7 days.
//
// The partial index on `needs_reindex` (used by the cron sweep) is created at
// the migration layer because TypeORM's `@Index` decorator can't express the
// `WHERE needs_reindex = true` predicate.
@Entity('project_ai_context')
export class ProjectAiContext {
  @PrimaryColumn({
    name: 'project_id',
    type: 'uuid',
    primaryKeyConstraintName: 'pk_project_ai_context',
  })
  public projectId!: string;

  @OneToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'project_id',
    foreignKeyConstraintName: 'fk_project_ai_context_to_projects',
  })
  public project!: Project;

  // ─── FE-derived ────────────────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 200, nullable: true })
  public domain!: string | null;

  @Column({ name: 'primary_stack', type: 'jsonb', nullable: true })
  public primaryStack!: string[] | null;

  @Column({ type: 'text', nullable: true })
  public conventions!: string | null;

  @Column({ name: 'planning_summary', type: 'text', nullable: true })
  public planningSummary!: string | null;

  @Column({ name: 'refine_summary', type: 'text', nullable: true })
  public refineSummary!: string | null;

  @Column({ name: 'extend_summary', type: 'text', nullable: true })
  public extendSummary!: string | null;

  // ─── BE-maintained ─────────────────────────────────────────────────────────

  // Compact task list. Shape per entry:
  //   { id, title, price, kanban_status, summary?: string, skills_required: [] }
  // BE maintains all fields except `summary`, which the FE patches via the
  // derived-write endpoint.
  @Column({ name: 'task_index', type: 'jsonb', default: [] })
  public taskIndex!: Record<string, unknown>[];

  // Skill usage clusters keyed by skill UUID. Written entirely by the FE.
  @Column({ name: 'skill_clusters', type: 'jsonb', default: {} })
  public skillClusters!: Record<string, unknown>;

  // Append-only audit trail for FE-derived writes and explicit decision
  // logging via POST /ai-context/decisions. Shape per entry:
  //   { at, decision, rationale, source, actor_user_id?, ... }
  @Column({ type: 'jsonb', default: [] })
  public decisions!: Record<string, unknown>[];

  // ─── Reindex bookkeeping ───────────────────────────────────────────────────

  @Column({
    name: 'last_indexed_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  public lastIndexedAt!: Date;

  @Column({ name: 'task_count_at_index', type: 'int', default: 0 })
  public taskCountAtIndex!: number;

  @Column({ name: 'needs_reindex', type: 'boolean', default: false })
  public needsReindex!: boolean;

  // ─── Audit ─────────────────────────────────────────────────────────────────

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  public readonly createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  public readonly updatedAt!: Date;
}
