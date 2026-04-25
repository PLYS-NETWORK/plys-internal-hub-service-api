export interface IUpdateTaskCommentRequest {
  /** Replacement rich-text editor JSON document. */
  readonly comment: Record<string, unknown>;
}
