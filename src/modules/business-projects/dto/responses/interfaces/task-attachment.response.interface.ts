export interface ITaskAttachmentResponse {
  id: string;
  file_id: string | null;
  file_name: string;
  file_url: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  uploaded_at: string;
}
