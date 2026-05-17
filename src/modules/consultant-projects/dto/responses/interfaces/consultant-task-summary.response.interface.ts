import { TaskKanbanStatus } from '@database/enums';

export interface IConsultantTaskSummaryResponse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly kanban_status: TaskKanbanStatus;
  readonly price: number;
  readonly due_date: Date | null;
  readonly assigned_at: Date | null;
  readonly started_at: Date | null;
  readonly completed_at: Date | null;
  readonly project_id: string;
}
