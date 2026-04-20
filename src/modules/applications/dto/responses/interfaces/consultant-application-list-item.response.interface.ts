export interface IProjectSummary {
  readonly id: string;
  readonly title: string;
}

export interface IConsultantApplicationListItemResponse {
  readonly id: string;
  readonly project: IProjectSummary;
  readonly status: string;
  readonly cover_letter: string | null;
  readonly applied_at: string;
}
