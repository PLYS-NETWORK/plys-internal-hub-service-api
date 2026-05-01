/**
 * Snapshot of an attached file persisted on the comment/evidence row. The
 * canonical `files` row may be soft-deleted later, but these fields stay
 * meaningful because they were copied at attach-time.
 */
export interface IBoardAttachmentResponse {
  id: string;
  file_id: string | null;
  file_name: string;
  file_url: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  uploaded_at: Date;
}
