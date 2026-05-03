import { IConsultantBoardAttachmentResponse } from './consultant-board-attachment.response.interface';

export interface IConsultantBoardCommentAuthor {
  user_id: string;
  // null when the author is a business owner — the same task surface accepts
  // comments from both sides, so the listing must accommodate either profile.
  consultant_id: string | null;
  full_name: string;
  avatar_url: string | null;
}

export interface IConsultantBoardCommentResponse {
  id: string;
  task_id: string;
  author: IConsultantBoardCommentAuthor;
  comment: Record<string, unknown>;
  is_edited: boolean;
  edited_at: Date | null;
  created_at: Date;
  attachments: IConsultantBoardAttachmentResponse[];
}
