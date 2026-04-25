import { TaskHistoryChangeType, TaskKanbanStatus } from '@database/enums';

export interface ITaskHistoryResponse {
  /** Unique identifier of the history record. */
  id: string;

  /** UUID of the task this history record belongs to. */
  task_id: string;

  /** The category of change that produced this record (status change, assignment, or unassignment). */
  change_type: TaskHistoryChangeType;

  /** Kanban status before the change; `null` for non-status change types. */
  previous_kanban_status: TaskKanbanStatus | null;

  /** Kanban status after the change; `null` for non-status change types. */
  new_kanban_status: TaskKanbanStatus | null;

  /** Consultant profile UUID that was unassigned; `null` when not applicable. */
  previous_assigned_to: string | null;

  /** Consultant profile UUID that was assigned; `null` when not applicable. */
  new_assigned_to: string | null;

  /** UUID of the user who triggered this change; `null` when performed by the system. */
  changed_by: string | null;

  /** Optional free-text note attached to the history record by the trigger or the actor. */
  note: string | null;

  /** Timestamp when the change was recorded (set by the database trigger). */
  changed_at: Date;
}
