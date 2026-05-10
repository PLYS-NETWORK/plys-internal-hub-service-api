import { SubmitAnswerDto } from '../dto/requests/submit-answer.dto';
import { InterviewQuestionResponseDto } from '../dto/responses/interview-question-response.dto';

export interface IInterviewService {
  /**
   * Returns the 30 assigned interview questions for the authenticated consultant.
   * Each question includes the current answer text if one was submitted.
   *
   * @throws TranslatableException — CONSULTANT_APPLICATION_NOT_FOUND if no active application.
   * @throws TranslatableException — CONSULTANT_APPLICATION_INTERVIEW_NOT_READY if status is not IN_INTERVIEW.
   */
  getInterviewQuestions(): Promise<InterviewQuestionResponseDto[]>;

  /**
   * Saves or updates the answer to a single interview question.
   * Idempotent: calling again with the same questionId overwrites the previous answer.
   *
   * @param dto Question ID and answer text.
   * @throws TranslatableException — CONSULTANT_APPLICATION_NOT_FOUND if no active application.
   * @throws TranslatableException — CONSULTANT_APPLICATION_INTERVIEW_NOT_READY if status is not IN_INTERVIEW.
   */
  submitAnswer(dto: SubmitAnswerDto): Promise<void>;

  /**
   * Finalises the interview: validates all 30 answers exist, transitions status to
   * INTERVIEW_SUBMITTED, sends confirmation email to consultant, and sends
   * notification + email to all active admin addresses.
   *
   * @throws TranslatableException — CONSULTANT_APPLICATION_NOT_FOUND if no active application.
   * @throws TranslatableException — CONSULTANT_APPLICATION_INTERVIEW_NOT_READY if status is not IN_INTERVIEW.
   * @throws TranslatableException — CONSULTANT_APPLICATION_INCOMPLETE_ANSWERS if < 30 answers.
   */
  finalizeInterview(): Promise<void>;
}
