export interface IFileResponse {
  /** UUID of the file row. */
  readonly id: string;
  /** Owner's user UUID. */
  readonly owner_user_id: string;
  /** Sniffed MIME type of the bytes. */
  readonly mime_type: string;
  /** Byte length of the stored object. */
  readonly size_bytes: number;
  /** Sanitised display name as uploaded by the client. */
  readonly original_name: string;
  /** Caller-supplied tag, or `null` when none was provided. */
  readonly purpose: string | null;
  /** Fresh URL valid at response time (presigned for cloud providers). */
  readonly url: string;
  /** ISO 8601 timestamp of when the file was created. */
  readonly created_at: string;
}
