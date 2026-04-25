export interface ICreateTaskEvidenceRequest {
  /** Rich-text editor JSON document persisted verbatim as `jsonb`. */
  readonly remarks: Record<string, unknown>;
  /** Optional list of file IDs (from /files) to attach. */
  readonly fileIds?: string[];
}
