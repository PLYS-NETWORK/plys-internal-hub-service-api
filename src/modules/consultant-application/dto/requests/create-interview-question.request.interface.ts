import { QuestionType } from '@database/enums';

export interface ICreateInterviewQuestionRequest {
  readonly type: QuestionType.COMMUNICATION | QuestionType.SYSTEM_KNOWLEDGE;
  readonly content: string;
  readonly displayOrder?: number;
}
