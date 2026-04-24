import { TaskDifficulty, TaskKanbanStatus } from '@database/enums';

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
