import { ApplicationStatus, QuestionType } from '@database/enums';

export interface IAnswerDetailResponse {
  readonly application_question_id: string;
  readonly question_order: number;
  readonly type: QuestionType;
  readonly content: string;
  readonly answer_text: string | null;
  readonly copyleaks_ai_score: number | null;
  readonly ai_eval_score: number | null;
  readonly ai_feedback: string | null;
  readonly admin_score: number | null;
  readonly admin_notes: string | null;
}

export interface IApplicationDetailResponse {
  readonly id: string;
  readonly status: ApplicationStatus;
  readonly consultant_email: string;
  readonly profile_submitted_at: string | null;
  readonly interview_submitted_at: string | null;
  readonly copyleaks_score: number | null;
  readonly ai_eval_score: number | null;
  readonly admin_eval_score: number | null;
  readonly final_score: number | null;
  readonly blocked_until: string | null;
  readonly rejection_reason: string | null;
  readonly answers: IAnswerDetailResponse[];
  readonly created_at: string;
}
