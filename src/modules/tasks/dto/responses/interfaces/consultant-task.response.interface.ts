import { TaskDifficulty, TaskKanbanStatus } from '@database/enums';

export interface IConsultantTaskResponse {
  /** UUID of the task record. */
  id: string;
  /** UUID of the project this task belongs to. */
  project_id: string;
  /** Short descriptive title of the deliverable. */
  title: string;
  /** Optional extended description of the task scope (TipTap/ProseMirror JSON document); `null` when not provided. */
  description: Record<string, unknown> | null;
  /** Estimated complexity of the task (e.g. `easy`, `medium`, `hard`). */
  difficulty_level: TaskDifficulty;
  /** Current Kanban column the task occupies (e.g. `todo`, `in_progress`, `done`). */
  kanban_status: TaskKanbanStatus;
  /** UUID of the consultant currently assigned to this task; `null` when unassigned. */
  assigned_to: string | null;
  /** Timestamp when the task was assigned to its current consultant; `null` when unassigned. */
  assigned_at: Date | null;
  /** 1-based position controlling the display order within the project task list. */
  display_order: number;
  /** Timestamp when the task record was created. */
  created_at: Date;
}
