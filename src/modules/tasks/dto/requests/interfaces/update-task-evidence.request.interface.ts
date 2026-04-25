export interface IUpdateTaskEvidenceRequest {
  /**
   * New rich-text JSON document for the evidence. Optional — omit to keep the
   * existing remarks unchanged.
   */
  readonly remarks?: Record<string, unknown>;
  /**
   * If provided, fully replaces the attachment list. Pass `[]` to remove all
   * attachments. Omit the field entirely to keep existing attachments.
   */
  readonly fileIds?: string[];
}
