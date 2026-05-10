import { AdminManualScoreDto } from '@modules/consultant-application/dto/requests/admin-manual-score.dto';
import { InterviewQuestionResponseDto } from '@modules/consultant-application/dto/responses/interview-question-response.dto';

export interface IAdminEvaluationService {
  /**
   * Returns the COMMUNICATION and SYSTEM_KNOWLEDGE Q&As for manual scoring.
   * Only accessible when `status = PENDING_ADMIN_EVALUATION`.
   *
   * @param applicationId UUID of the consultant application.
   * @throws TranslatableException — CONSULTANT_APPLICATION_NOT_FOUND if not found.
   * @throws TranslatableException — CONSULTANT_APPLICATION_INVALID_STATUS if not PENDING_ADMIN_EVALUATION.
   */
  getManualQuestions(applicationId: string): Promise<InterviewQuestionResponseDto[]>;

  /**
   * Saves admin per-answer scores for manual questions, records adminEvalScore,
   * calculates finalScore = AI×0.6 + Admin×0.4, and transitions status to
   * PENDING_FINAL_DECISION.
   *
   * @param applicationId UUID of the consultant application.
   * @param dto Per-answer scores and overall admin eval score.
   * @throws TranslatableException — CONSULTANT_APPLICATION_NOT_FOUND if not found.
   * @throws TranslatableException — CONSULTANT_APPLICATION_INVALID_STATUS if not PENDING_ADMIN_EVALUATION.
   */
  submitManualEvaluation(applicationId: string, dto: AdminManualScoreDto): Promise<void>;
}
