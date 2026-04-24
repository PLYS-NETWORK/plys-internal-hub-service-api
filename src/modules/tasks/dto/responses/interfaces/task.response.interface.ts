import { TaskDifficulty, TaskKanbanStatus } from '@database/enums';

export interface ITaskResponse {
  readonly id: string;
  readonly project_id: string;
  readonly title: string;
  readonly description: string | null;
  readonly price: number;
  readonly platform_fee_amount: number;
  readonly consultant_payout: number;
  readonly difficulty_level: TaskDifficulty;
  readonly kanban_status: TaskKanbanStatus;
  readonly assigned_to: string | null;
  readonly assigned_at: Date | null;
  readonly approved_by: string | null;
  readonly approved_at: Date | null;
  readonly display_order: number;
  readonly created_at: Date;
}
