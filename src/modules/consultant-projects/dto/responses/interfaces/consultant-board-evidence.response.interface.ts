import { IConsultantBoardAttachmentResponse } from './consultant-board-attachment.response.interface';

export interface IConsultantBoardEvidenceAuthor {
  user_id: string;
  consultant_id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface IConsultantBoardEvidenceResponse {
  id: string;
  task_id: string;
  author: IConsultantBoardEvidenceAuthor;
  remarks: Record<string, unknown>;
  is_edited: boolean;
  edited_at: Date | null;
  created_at: Date;
  attachments: IConsultantBoardAttachmentResponse[];
}
