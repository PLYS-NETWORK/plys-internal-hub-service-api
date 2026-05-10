import { QuestionType } from '@database/enums';

export interface IInterviewQuestionBankResponse {
  readonly id: string;
  readonly type: QuestionType;
  readonly content: string;
  readonly is_active: boolean;
  readonly display_order: number | null;
  readonly created_at: string;
}
