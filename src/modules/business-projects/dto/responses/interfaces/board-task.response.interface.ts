import { TaskKanbanStatus } from '@database/enums';

import { IBoardTaskAttachmentResponse } from './board-task-attachment.response.interface';

export interface IBoardTaskAssignee {
  consultant_id: string;
  full_name: string;
  avatar_url: string | null;
}

/**
 * Time-on-task aggregate.
 *  - When < 24 h, only `hours` is returned.
 *  - When >= 24 h, `days` + the integer-hour remainder (0–23) are returned.
 *  - `total_seconds` is always present so the UI can sort/recompute.
 */
export interface IBoardTaskWorkedDuration {
  days?: number;
  hours: number;
  total_seconds: number;
}

export interface IBoardTaskResponse {
  id: string;
  code: string;
  title: string;
  description: Record<string, unknown> | null;
  kanban_status: TaskKanbanStatus;
  price: string;
  assignee: IBoardTaskAssignee | null;
  total_time_worked: IBoardTaskWorkedDuration;
  attachments_count: number;
  last_update: string;
  created_day: string;
}

export interface IBoardTaskDetailResponse extends IBoardTaskResponse {
  platform_fee_amount: string;
  consultant_payout: string;
  approved_by: string | null;
  approved_at: string | null;
  due_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  version: number;
  attachments: IBoardTaskAttachmentResponse[];
}
