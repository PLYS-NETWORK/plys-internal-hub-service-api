import { TaskCreationMode, TaskKanbanStatus } from '@database/enums';

export interface IBoardTaskAssignee {
  consultant_id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface IBoardTaskResponse {
  id: string;
  code: string;
  title: string;
  price: string;
  creation_mode: TaskCreationMode;
  kanban_status: TaskKanbanStatus;
  display_order: number;
  assignee: IBoardTaskAssignee | null;
  evidences_count: number;
}

export interface IBoardTaskDetailResponse extends IBoardTaskResponse {
  description: Record<string, unknown> | null;
  platform_fee_amount: string;
  consultant_payout: string;
  approved_by: string | null;
  approved_at: Date | null;
  due_date: Date | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}
