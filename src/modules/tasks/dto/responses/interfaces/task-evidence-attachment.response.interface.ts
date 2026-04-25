export interface ITaskEvidenceAttachmentResponse {
  /** UUID of the attachment row. */
  readonly id: string;
  /** UUID of the canonical files row, or `null` if the source file was removed. */
  readonly file_id: string | null;
  /** Original filename, sanitised for display. */
  readonly file_name: string;
  /** Public/signed URL captured at attach time. */
  readonly file_url: string;
  /** Sniffed MIME type; may be `null` for legacy rows. */
  readonly mime_type: string | null;
  /** Size in bytes; nullable for legacy rows where the size was unknown. */
  readonly file_size_bytes: number | null;
  /** Timestamp when the attachment row was created. */
  readonly uploaded_at: Date;
}
