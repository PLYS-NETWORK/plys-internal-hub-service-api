import { ISkillExamSummaryResponse } from './skill-exam-summary.response.interface';

export interface ISkillExamQuestionView {
  readonly id: string;
  readonly exam_question_id: string;
  readonly question_order: number;
  readonly content: string;
  readonly answer_text: string | null;
}

export interface ISkillExamDetailResponse extends ISkillExamSummaryResponse {
  readonly questions: ISkillExamQuestionView[];
}
