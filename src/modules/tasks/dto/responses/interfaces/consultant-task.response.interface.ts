import { TaskDifficulty } from '@database/enums/task-difficulty.enum';
import { TaskKanbanStatus } from '@database/enums/task-kanban-status.enum';

export interface IConsultantTaskResponse {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  difficulty_level: TaskDifficulty;
  kanban_status: TaskKanbanStatus;
  assigned_to: string | null;
  assigned_at: Date | null;
  display_order: number;
  created_at: Date;
}
