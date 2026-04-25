import { TaskDifficulty, TaskKanbanStatus } from '@database/enums';

export interface ITaskResponse {
  /** UUID of the task record. */
  readonly id: string;
  /** UUID of the project this task belongs to. */
  readonly project_id: string;
  /** Short descriptive title of the deliverable. */
  readonly title: string;
  /** Optional extended description of the task scope (TipTap/ProseMirror JSON document); `null` when not provided. */
  readonly description: Record<string, unknown> | null;
  /** Total task price charged to the business, in the platform's base currency (minor units). */
  readonly price: number;
  /** Platform fee deducted from the task price before paying the consultant. */
  readonly platform_fee_amount: number;
  /** Net amount paid out to the consultant after platform fee deduction. */
  readonly consultant_payout: number;
  /** Estimated complexity of the task (e.g. `easy`, `medium`, `hard`). */
  readonly difficulty_level: TaskDifficulty;
  /** Current Kanban column the task occupies (e.g. `todo`, `in_progress`, `done`). */
  readonly kanban_status: TaskKanbanStatus;
  /** UUID of the consultant currently assigned to this task; `null` when unassigned. */
  readonly assigned_to: string | null;
  /** Timestamp when the task was assigned to its current consultant; `null` when unassigned. */
  readonly assigned_at: Date | null;
  /** UUID of the business user who approved task completion; `null` until approval. */
  readonly approved_by: string | null;
  /** Timestamp when the task was approved as complete; `null` until approval. */
  readonly approved_at: Date | null;
  /** 1-based position controlling the display order within the project task list. */
  readonly display_order: number;
  /** Timestamp when the task record was created. */
  readonly created_at: Date;
}
