export interface ITaskCommentResponse {
  /** UUID of the comment record. */
  readonly id: string;
  /** UUID of the task this comment was posted on. */
  readonly task_id: string;
  /** UUID of the user (consultant or business) who authored the comment. */
  readonly author_id: string;
  /** Rich-text editor JSON document round-tripped from the editor. */
  readonly comment: Record<string, unknown>;
  /** `true` when the comment has been edited at least once after creation. */
  readonly is_edited: boolean;
  /** Timestamp of the most recent edit; `null` when the comment has never been edited. */
  readonly edited_at: Date | null;
  /** Timestamp when the comment was first created. */
  readonly created_at: Date;
}
