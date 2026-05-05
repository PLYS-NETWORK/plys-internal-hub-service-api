import { TaskKanbanStatus } from '@database/enums';

export interface IConsultantBoardTaskAssignee {
  consultant_id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface IConsultantBoardTaskResponse {
  id: string;
  code: string;
  title: string;
  kanban_status: TaskKanbanStatus;
  display_order: number;
  assignee: IConsultantBoardTaskAssignee | null;
  evidences_count: number;
}
