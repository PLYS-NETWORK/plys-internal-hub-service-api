import { TaskKanbanStatus } from '@database/enums';

export interface IProjectTaskStatsResponse {
  project_id: string;
  /** Tasks excluding `cancelled` and soft-deleted rows. */
  total_open: number;
  /** Counts keyed by every value of `TaskKanbanStatus`. Zero buckets present. */
  by_status: Record<TaskKanbanStatus, number>;
}
