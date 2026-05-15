import { SubmitOnboardingAnswersDto } from '../dto/requests/submit-onboarding-answers.dto';
import { OnboardingQuestionResponseDto } from '../dto/responses/onboarding-question-response.dto';

/**
 * Contract for the onboarding-interview service.
 *
 * Caller identity is resolved internally via `RequestContextService`.
 */
export interface IOnboardingInterviewService {
  /**
   * Returns the current set of active onboarding questions (admin-managed bank)
   * ordered by position ASC. Allowed only when the consultant's onboarding is
   * in `IN_INTERVIEW`.
   *
   * @returns Ordered array of active questions.
   * @throws TranslatableException (404, CONSULTANT_ONBOARDING_NOT_FOUND).
   * @throws TranslatableException (409, CONSULTANT_ONBOARDING_INVALID_STATUS) when status is not `IN_INTERVIEW`.
   */
  getQuestions(): Promise<OnboardingQuestionResponseDto[]>;

  /**
   * Bulk-submits one answer per active question and finalises the interview:
   * inserts every answer with a frozen `question_snapshot`, transitions the
   * onboarding to `INTERVIEW_SUBMITTED`, then notifies the consultant + admins.
   *
   * @param dto The full set of answers, one per active question.
   * @throws TranslatableException (404, CONSULTANT_ONBOARDING_NOT_FOUND).
   * @throws TranslatableException (409, CONSULTANT_ONBOARDING_INVALID_STATUS) when status is not `IN_INTERVIEW`.
   * @throws TranslatableException (422, CONSULTANT_ONBOARDING_ANSWERS_COVERAGE) when the answer set does not cover the active questions exactly.
   * @throws TranslatableException (422, CONSULTANT_ONBOARDING_INVALID_ANSWER) when an individual answer's shape does not match its question type.
   */
  submitAnswers(dto: SubmitOnboardingAnswersDto): Promise<void>;
}
