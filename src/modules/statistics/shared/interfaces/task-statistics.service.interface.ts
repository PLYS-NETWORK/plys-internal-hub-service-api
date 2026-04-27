import { StatsDateRangeDto } from '../../dto/requests/stats-date-range.dto';
import { TaskStatsResponseDto } from '../../dto/responses/task-stats-response.dto';
import { TasksCompletionResponseDto } from '../../dto/responses/tasks-completion-response.dto';
import { TasksOverdueResponseDto } from '../../dto/responses/tasks-overdue-response.dto';

export interface ITaskStatisticsService {
  /**
   * Aggregates task counts grouped by `kanban_status` across all projects
   * visible to the caller.
   *
   * @param query Optional date range / project filter.
   * @returns Total non-cancelled tasks plus per-status counts.
   */
  getStats(query: StatsDateRangeDto): Promise<TaskStatsResponseDto>;

  /**
   * Returns the count of tasks past their `due_date` (and not yet `done` /
   * `cancelled`), broken down per project.
   *
   * @param query Optional project filter.
   * @returns Total overdue + per-project breakdown sorted by overdue desc.
   */
  getOverdue(query: StatsDateRangeDto): Promise<TasksOverdueResponseDto>;

  /**
   * Returns task completion rates (done / total) per project, sorted by rate
   * descending so progress laggers surface last.
   *
   * @param query Optional date range / project filter.
   * @returns Per-project completion metrics.
   */
  getCompletion(query: StatsDateRangeDto): Promise<TasksCompletionResponseDto>;
}
