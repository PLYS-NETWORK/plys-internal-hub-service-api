import { TaskDifficulty } from '@database/enums/task-difficulty.enum';
import { TaskKanbanStatus } from '@database/enums/task-kanban-status.enum';

export interface IProjectTaskResponse {
  id: string;
  title: string;
  description: string | null;
  price: number;
  platform_fee_amount: number;
  consultant_payout: number;
  difficulty_level: TaskDifficulty;
  kanban_status: TaskKanbanStatus;
  display_order: number;
  created_at: Date;
}
