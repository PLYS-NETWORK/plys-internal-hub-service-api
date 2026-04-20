export interface IMatchedSkillResponse {
  readonly id: string;
  readonly name: string;
}

export interface IApplicationResponse {
  readonly id: string;
  readonly project_id: string;
  readonly status: string;
  readonly cover_letter: string | null;
  readonly matched_skills: IMatchedSkillResponse[];
  readonly applied_at: string;
}
