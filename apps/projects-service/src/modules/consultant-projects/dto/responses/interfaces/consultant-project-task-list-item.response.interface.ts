import { TaskKanbanStatus } from '@plys/libraries/database/enums';

export interface IConsultantProjectTaskListItemResponse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly kanban_status: TaskKanbanStatus;
  readonly price: number;
  readonly due_date: Date | null;
  readonly started_at: Date | null;
  readonly completed_at: Date | null;
  readonly assigned_at: Date | null;
  /** True when the caller is the current assignee. */
  readonly is_mine: boolean;
}
