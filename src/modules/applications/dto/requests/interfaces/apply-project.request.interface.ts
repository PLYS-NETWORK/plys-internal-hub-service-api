export interface IInterviewAnswerInput {
  readonly questionId: string;
  readonly answerText: string;
}

export interface IApplyProjectRequest {
  readonly projectId: string;
  readonly coverLetter?: string;
  readonly answers?: IInterviewAnswerInput[];
}
