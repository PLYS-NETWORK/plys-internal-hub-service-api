import { TaskCreationMode } from '@plys/libraries/database/enums';

import { ITaskAttachmentResponse } from './task-attachment.response.interface';

export interface IDraftTaskResponse {
  id: string;
  code: string;
  title: string;
  description: Record<string, unknown> | null;
  price: string;
  platform_fee_amount: string;
  consultant_payout: string;
  creation_mode: TaskCreationMode;
  created_at: Date;
  updated_at: Date;
  attachments_count: number;
  attachments: ITaskAttachmentResponse[];
}
