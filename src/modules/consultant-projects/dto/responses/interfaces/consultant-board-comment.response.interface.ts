import { IConsultantBoardAttachmentResponse } from './consultant-board-attachment.response.interface';

export interface IConsultantBoardCommentAuthor {
  user_id: string;
  consultant_id: string;
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
