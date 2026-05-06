import { IBoardAttachmentResponse } from './board-attachment.response.interface';

export interface IBoardResultAuthor {
  consultant_id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface IBoardResultResponse {
  id: string;
  task_id: string;
  author: IBoardResultAuthor;
  remarks: Record<string, unknown>;
  is_edited: boolean;
  edited_at: string | null;
  created_at: string;
  attachments: IBoardAttachmentResponse[];
}
