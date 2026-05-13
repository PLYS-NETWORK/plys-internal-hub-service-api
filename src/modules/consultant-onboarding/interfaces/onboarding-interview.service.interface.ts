import { SubmitOnboardingAnswerDto } from '../dto/requests/submit-onboarding-answer.dto';
import { OnboardingQuestionResponseDto } from '../dto/responses/onboarding-question-response.dto';

/**
 * Contract for the onboarding-interview service (10-question gate read by an admin).
 *
 * Caller identity is resolved internally via `RequestContextService`.
 */
export interface IOnboardingInterviewService {
  /**
   * Returns the consultant's 10 assigned onboarding questions with any saved
   * answers. Allowed only when the onboarding is in `IN_INTERVIEW`.
   *
   * @returns Ordered array (question_order 1–10).
   * @throws TranslatableException (404, CONSULTANT_ONBOARDING_NOT_FOUND).
   * @throws TranslatableException (409, CONSULTANT_ONBOARDING_INVALID_STATUS) when status is not `IN_INTERVIEW`.
   */
  getQuestions(): Promise<OnboardingQuestionResponseDto[]>;

  /**
   * Saves or updates the answer for a single onboarding question. Idempotent —
   * calling again with the same `onboarding_question_id` overwrites the prior
   * answer. Allowed only while `IN_INTERVIEW`.
   *
   * @param dto The question id + answer text payload.
   * @throws TranslatableException (404, CONSULTANT_ONBOARDING_NOT_FOUND) — no onboarding or the question does not belong to it.
   * @throws TranslatableException (409, CONSULTANT_ONBOARDING_INVALID_STATUS) when status is not `IN_INTERVIEW`.
   */
  submitAnswer(dto: SubmitOnboardingAnswerDto): Promise<void>;

  /**
   * Finalises the interview. Verifies all 10 answers are present, transitions
   * the onboarding to `INTERVIEW_SUBMITTED`, emails the consultant, and emails
   * active admins (first admin as TO, rest as CC).
   *
   * @throws TranslatableException (404, CONSULTANT_ONBOARDING_NOT_FOUND).
   * @throws TranslatableException (409, CONSULTANT_ONBOARDING_INVALID_STATUS) when status is not `IN_INTERVIEW`.
   * @throws TranslatableException (422, CONSULTANT_ONBOARDING_INCOMPLETE_ANSWERS) when fewer than 10 answers are saved.
   */
  submit(): Promise<void>;
}
