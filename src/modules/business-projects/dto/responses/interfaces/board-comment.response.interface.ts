import { IBoardAttachmentResponse } from './board-attachment.response.interface';

export interface IBoardCommentAuthor {
  user_id: string;
  name: string;
  avatar_url: string | null;
}

export interface IBoardCommentResponse {
  id: string;
  task_id: string;
  author: IBoardCommentAuthor;
  comment: Record<string, unknown>;
  is_edited: boolean;
  edited_at: Date | null;
  created_at: Date;
  attachments: IBoardAttachmentResponse[];
}
