import { CreateInterviewQuestionDto } from '@modules/consultant-application/dto/requests/create-interview-question.dto';
import { UpdateInterviewQuestionDto } from '@modules/consultant-application/dto/requests/update-interview-question.dto';
import { InterviewQuestionBankResponseDto } from '@modules/consultant-application/dto/responses/interview-question-bank-response.dto';

export interface IInterviewQuestionBankService {
  /**
   * Returns all interview questions, optionally filtered by type and/or active status.
   */
  list(filters?: {
    type?: string;
    isActive?: boolean;
  }): Promise<InterviewQuestionBankResponseDto[]>;

  /**
   * Creates a new COMMUNICATION or SYSTEM_KNOWLEDGE question.
   * SKILL_BASED questions are created programmatically by the AI — not by admin.
   *
   * @param dto Question type, content, and optional display order.
   * @throws TranslatableException — INTERVIEW_QUESTION_INVALID_TYPE if type = SKILL_BASED.
   */
  create(dto: CreateInterviewQuestionDto): Promise<InterviewQuestionBankResponseDto>;

  /**
   * Updates question content and/or display order.
   *
   * @param questionId UUID of the interview question.
   * @param dto Fields to update.
   * @throws TranslatableException — INTERVIEW_QUESTION_NOT_FOUND if not found.
   */
  update(
    questionId: string,
    dto: UpdateInterviewQuestionDto,
  ): Promise<InterviewQuestionBankResponseDto>;

  /**
   * Toggles the `isActive` flag on a question.
   *
   * @param questionId UUID of the interview question.
   * @throws TranslatableException — INTERVIEW_QUESTION_NOT_FOUND if not found.
   */
  toggleActive(questionId: string): Promise<InterviewQuestionBankResponseDto>;
}
