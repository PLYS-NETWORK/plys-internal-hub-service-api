export interface IAnswerScoreEntry {
  readonly applicationQuestionId: string;
  readonly score: number;
  readonly notes?: string;
}

export interface IAdminManualScoreRequest {
  readonly scores: IAnswerScoreEntry[];
  readonly adminEvalScore: number;
}
