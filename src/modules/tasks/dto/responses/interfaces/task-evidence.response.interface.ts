import { ITaskEvidenceAttachmentResponse } from './task-evidence-attachment.response.interface';

export interface ITaskEvidenceResponse {
  /** UUID of the evidence record. */
  readonly id: string;
  /** UUID of the task this evidence belongs to. */
  readonly task_id: string;
  /** UUID of the consultant user who authored the evidence. */
  readonly author_id: string;
  /** Rich-text JSON document round-tripped from the editor. */
  readonly remarks: Record<string, unknown>;
  /** `true` once the evidence has been edited at least once. */
  readonly is_edited: boolean;
  /** Timestamp of the most recent edit; `null` when never edited. */
  readonly edited_at: Date | null;
  /** Timestamp when the evidence was first created. */
  readonly created_at: Date;
  /** File attachments linked to this evidence. */
  readonly attachments: ITaskEvidenceAttachmentResponse[];
}
