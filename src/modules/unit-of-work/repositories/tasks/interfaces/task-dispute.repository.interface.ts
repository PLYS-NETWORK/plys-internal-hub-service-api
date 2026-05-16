import { AbstractRepository } from '@common/repositories';
import { TaskDispute } from '@database/entities';

/** Open dispute row surfaced in the business action-items endpoint. */
export interface IBusinessDisputeRow {
  dispute_id: string;
  task_id: string;
  task_code: string;
  /** First ~120 characters of `reason`, server-trimmed for the action queue. */
  reason_snippet: string;
  opened_at: Date;
}

export interface ITaskDisputeRepository extends AbstractRepository<TaskDispute> {
  /**
   * Counts task disputes in `OPEN` status. Used by the admin dashboard's
   * operational-queues card.
   */
  countOpen(): Promise<number>;

  /**
   * Per-business count of `OPEN` disputes — joins through `task` → `project`
   * and filters to `project.business_id`. Used by the business-dashboard
   * `action_counts.open_disputes` KPI.
   */
  countOpenByBusinessId(businessId: string): Promise<number>;

  /**
   * Top-N `OPEN` disputes for the business, sorted by `opened_at` ASC
   * (oldest first — those are the ones the owner has been sitting on).
   */
  findOpenByBusinessId(businessId: string, limit: number): Promise<IBusinessDisputeRow[]>;

  /**
   * Per-project count of `OPEN` disputes. Joins through `task` and filters by
   * `task.project_id`. Used by the per-project overview's action-items count.
   */
  countOpenByProjectId(projectId: string): Promise<number>;

  /**
   * Top-N `OPEN` disputes scoped to a single project, sorted by `opened_at`
   * ASC. Same row shape as {@link findOpenByBusinessId}.
   */
  findOpenByProjectId(projectId: string, limit: number): Promise<IBusinessDisputeRow[]>;
}
