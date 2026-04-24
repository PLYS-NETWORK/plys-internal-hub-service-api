import { TaskDifficulty, TaskKanbanStatus } from '@database/enums';

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
