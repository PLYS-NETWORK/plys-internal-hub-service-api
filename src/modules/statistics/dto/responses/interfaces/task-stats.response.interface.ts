import { TaskKanbanStatus } from '@database/enums';

export interface ITaskStatsResponse {
  /** Tasks across the caller's projects excluding `cancelled` and soft-deleted rows. */
  total_open: number;
  /** Counts keyed by every value of `TaskKanbanStatus`. Statuses with zero count are still present. */
  by_status: Record<TaskKanbanStatus, number>;
}
