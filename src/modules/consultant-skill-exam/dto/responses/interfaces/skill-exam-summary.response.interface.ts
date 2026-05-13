export interface ISkillExamSummaryResponse {
  readonly id: string;
  readonly skill_id: string;
  readonly skill_name: string;
  readonly status: string;
  readonly consultant_view_status: string;
  readonly attempt_number: number;
  readonly ai_eval_score: string | null;
  readonly correct_count: number | null;
  readonly assigned_proficiency: string | null;
  readonly cooldown_until: string | null;
  readonly fail_reason: string | null;
  readonly started_at: string | null;
  readonly expires_at: string | null;
  readonly remaining_seconds: number | null;
  readonly submitted_at: string | null;
  readonly concluded_at: string | null;
  readonly created_at: string;
}
