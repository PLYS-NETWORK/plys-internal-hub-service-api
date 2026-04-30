import { IBoardAttachmentResponse } from './board-attachment.response.interface';

export interface IBoardEvidenceAuthor {
  consultant_id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface IBoardEvidenceResponse {
  id: string;
  task_id: string;
  author: IBoardEvidenceAuthor;
  remarks: Record<string, unknown>;
  is_edited: boolean;
  edited_at: Date | null;
  created_at: Date;
  attachments: IBoardAttachmentResponse[];
}
