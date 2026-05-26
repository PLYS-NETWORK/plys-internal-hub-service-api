export interface IAdminSkillExamListItemResponse {
  readonly id: string;
  readonly consultant_user_id: string;
  readonly consultant_full_name: string;
  readonly skill_id: string;
  readonly skill_name: string;
  readonly status: string;
  readonly assigned_proficiency: string | null;
  readonly ai_eval_score: string | null;
  readonly attempt_number: number;
  readonly fail_reason: string | null;
  readonly submitted_at: string | null;
  readonly concluded_at: string | null;
  readonly created_at: string;
}

export interface IAdminSkillExamPaginationMeta {
  readonly page: number;
  readonly take: number;
  readonly item_count: number;
  readonly page_count: number;
  readonly has_previous_page: boolean;
  readonly has_next_page: boolean;
}

export interface IAdminPaginatedSkillExamsResponse {
  readonly data: IAdminSkillExamListItemResponse[];
  readonly meta: IAdminSkillExamPaginationMeta;
}
