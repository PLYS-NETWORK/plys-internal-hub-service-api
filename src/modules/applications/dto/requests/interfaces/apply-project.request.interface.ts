export interface IInterviewAnswerInput {
  readonly questionId: string;
  /** Rich-text editor JSON document (TipTap/ProseMirror tree). */
  readonly answer: Record<string, unknown>;
}

export interface IApplyProjectRequest {
  readonly projectId: string;
  readonly coverLetter?: string;
  readonly answers?: IInterviewAnswerInput[];
}
