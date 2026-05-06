import { TaskHistoryChangeType, TaskKanbanStatus } from '@database/enums';

export interface IBoardHistoryAssignee {
  consultant_id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface IBoardHistoryAuthor {
  user_id: string | null;
  name: string;
  avatar_url: string | null;
}

export interface IBoardTaskHistoryResponse {
  id: string;
  task_id: string;
  change_type: TaskHistoryChangeType;
  previous_kanban_status: TaskKanbanStatus | null;
  new_kanban_status: TaskKanbanStatus | null;
  previous_assignee: IBoardHistoryAssignee | null;
  new_assignee: IBoardHistoryAssignee | null;
  author: IBoardHistoryAuthor;
  note: string | null;
  changed_at: string;
}
