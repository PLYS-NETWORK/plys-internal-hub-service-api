export interface ICreateTaskCommentRequest {
  /** Rich-text editor JSON document (TipTap/ProseMirror tree) persisted verbatim as `jsonb`. */
  readonly comment: Record<string, unknown>;
}
