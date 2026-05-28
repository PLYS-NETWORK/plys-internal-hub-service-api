import { IAdminSkillExamListItemResponse } from './skill-exam-list-item.response.interface';

export interface IAdminSkillExamQuestionView {
  readonly id: string;
  readonly question_order: number;
  readonly content: string;
  readonly answer_text: string | null;
  readonly ai_eval_score: string | null;
  readonly copyleaks_ai_score: string | null;
  readonly is_correct: boolean | null;
  readonly ai_feedback: string | null;
}

export interface IAdminSkillExamDetailResponse extends IAdminSkillExamListItemResponse {
  readonly bio: string | null;
  readonly consultant_email: string;
  readonly started_at: string | null;
  readonly expires_at: string | null;
  readonly copyleaks_aggregate_score: string | null;
  readonly cooldown_until: string | null;
  readonly correct_count: number | null;
  readonly questions: IAdminSkillExamQuestionView[];
}
