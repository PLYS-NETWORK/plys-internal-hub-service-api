import { QuestionType } from '@database/enums';

export interface IInterviewQuestionResponse {
  readonly id: string;
  readonly application_question_id: string;
  readonly question_order: number;
  readonly type: QuestionType;
  readonly content: string;
  readonly answer_text: string | null;
}
