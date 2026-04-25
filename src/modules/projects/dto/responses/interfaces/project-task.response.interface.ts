import { TaskDifficulty, TaskKanbanStatus } from '@database/enums';

export interface IProjectTaskResponse {
  /** UUID of the task record. */
  id: string;
  /** Short descriptive title of the deliverable. */
  title: string;
  /** Optional extended description of the task scope; `null` when not provided. */
  description: string | null;
  /** Total task price charged to the business, in the platform's base currency (minor units). */
  price: number;
  /** Platform fee deducted from the task price before paying the consultant. */
  platform_fee_amount: number;
  /** Net amount paid out to the consultant after platform fee deduction. */
  consultant_payout: number;
  /** Estimated complexity of the task (e.g. `easy`, `medium`, `hard`). */
  difficulty_level: TaskDifficulty;
  /** Current Kanban column the task occupies (e.g. `todo`, `in_progress`, `done`). */
  kanban_status: TaskKanbanStatus;
  /** 1-based position controlling the display order within the project task list. */
  display_order: number;
  /** Timestamp when the task record was created. */
  created_at: Date;
}
