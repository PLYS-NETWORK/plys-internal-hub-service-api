import { StartSkillExamDto } from '../dto/requests/start-skill-exam.dto';
import { SubmitSkillExamAnswerDto } from '../dto/requests/submit-skill-exam-answer.dto';
import { SkillExamDetailResponseDto } from '../dto/responses/skill-exam-detail-response.dto';
import { SkillExamEligibilityResponseDto } from '../dto/responses/skill-exam-eligibility-response.dto';
import { SkillExamSummaryResponseDto } from '../dto/responses/skill-exam-summary-response.dto';

/**
 * Contract for the consultant-facing skill-exam service.
 */
export interface IConsultantSkillExamService {
  /**
   * Returns the consultant's single non-terminal skill exam, or null when none.
   * Lazy-expires the row if its 60-min deadline has passed before returning.
   */
  getCurrent(): Promise<SkillExamSummaryResponseDto | null>;

  /**
   * Returns whether the caller can register a new exam right now. Single source
   * of truth for the Lona "Start exam" button.
   */
  getEligibility(): Promise<SkillExamEligibilityResponseDto>;

  /**
   * Registers a skill and starts a new exam attempt — enqueues
   * `GENERATE_SKILL_EXAM_QUESTIONS` and returns the freshly created row.
   *
   * @throws TranslatableException (403) when banned / onboarding not approved.
   * @throws TranslatableException (403, SKILL_EXAM_TAKING_BLOCKED) when the
   *         platform-wide cool-down is active.
   * @throws TranslatableException (404, PROJECT_SKILL_NOT_FOUND).
   * @throws TranslatableException (409, SKILL_EXAM_ALREADY_PASSED).
   * @throws TranslatableException (409, SKILL_EXAM_ALREADY_IN_PROGRESS).
   * @throws TranslatableException (409, SKILL_EXAM_PARALLEL_LIMIT_REACHED).
   * @throws TranslatableException (422, SKILL_EXAM_COOLDOWN_ACTIVE).
   */
  start(dto: StartSkillExamDto): Promise<SkillExamSummaryResponseDto>;

  /**
   * Returns the exam detail (including AI-generated questions and any
   * saved answers). Lazy-expires the row if the 60-min deadline has passed.
   *
   * @throws TranslatableException (404, SKILL_EXAM_NOT_FOUND).
   * @throws TranslatableException (409, SKILL_EXAM_EXPIRED) when the exam was
   *         just expired by the lazy check.
   */
  getDetail(examId: string): Promise<SkillExamDetailResponseDto>;

  /**
   * Upserts a single answer. Idempotent — re-submitting overwrites. Allowed
   * only while the exam status is `IN_PROGRESS` AND before `expires_at`.
   *
   * @throws TranslatableException (404, SKILL_EXAM_NOT_FOUND).
   * @throws TranslatableException (409, SKILL_EXAM_INVALID_STATUS).
   * @throws TranslatableException (409, SKILL_EXAM_EXPIRED).
   */
  submitAnswer(examId: string, dto: SubmitSkillExamAnswerDto): Promise<void>;

  /**
   * Finalises the exam. Verifies all 20 answers are present, advances to
   * `SUBMITTED`, enqueues `RUN_SKILL_EXAM_COPYLEAKS`, and emits the
   * `CONSULTANT_SKILL_EXAM_SUBMITTED` notification event. Surfaces
   * `consultant_view_status = PENDING_REVIEW` in the response.
   *
   * @throws TranslatableException (404, SKILL_EXAM_NOT_FOUND).
   * @throws TranslatableException (409, SKILL_EXAM_INVALID_STATUS).
   * @throws TranslatableException (409, SKILL_EXAM_EXPIRED).
   * @throws TranslatableException (422, SKILL_EXAM_INCOMPLETE_ANSWERS).
   */
  submit(examId: string): Promise<void>;

  /**
   * Server-only: marks the exam as EXPIRED, increments the platform-wide
   * counter on `User`, and sets the 2-day cool-down on the 3rd expiration.
   * Idempotent — safe to call from both the lazy-expiry path and the sweep job.
   */
  expireExam(examId: string): Promise<void>;
}
