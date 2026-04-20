export interface IConsultantSummary {
  readonly id: string;
  readonly full_name: string;
  readonly avatar_url: string | null;
}

export interface IBusinessApplicationListItemResponse {
  readonly id: string;
  readonly project_id: string;
  readonly consultant: IConsultantSummary;
  readonly status: string;
  readonly cover_letter: string | null;
  readonly applied_at: string;
  readonly reviewed_at: string | null;
}
