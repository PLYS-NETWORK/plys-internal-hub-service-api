export interface IConsultantBoardAttachmentResponse {
  id: string;
  file_id: string | null;
  file_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  uploaded_at: Date;
}
