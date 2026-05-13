import { StartSkillExamDto } from '../dto/requests/start-skill-exam.dto';
import { SubmitSkillExamAnswerDto } from '../dto/requests/submit-skill-exam-answer.dto';
import { SkillExamDetailResponseDto } from '../dto/responses/skill-exam-detail-response.dto';
import { SkillExamSummaryResponseDto } from '../dto/responses/skill-exam-summary-response.dto';

/**
 * Contract for the consultant-facing skill-exam service.
 */
export interface IConsultantSkillExamService {
  /**
   * Returns every skill exam attempted by the caller, newest first.
   */
  listMine(): Promise<SkillExamSummaryResponseDto[]>;

  /**
   * Registers a skill and starts a new exam attempt — enqueues
   * `GENERATE_SKILL_EXAM_QUESTIONS` and returns the freshly created row.
   *
   * @throws TranslatableException (403) when banned / onboarding not approved.
   * @throws TranslatableException (404, PROJECT_SKILL_NOT_FOUND).
   * @throws TranslatableException (409, SKILL_EXAM_ALREADY_PASSED).
   * @throws TranslatableException (409, SKILL_EXAM_ALREADY_IN_PROGRESS).
   * @throws TranslatableException (409, SKILL_EXAM_PARALLEL_LIMIT_REACHED).
   * @throws TranslatableException (422, SKILL_EXAM_COOLDOWN_ACTIVE).
   */
  start(dto: StartSkillExamDto): Promise<SkillExamSummaryResponseDto>;

  /**
   * Returns the exam detail (including AI-generated questions and any
   * saved answers).
   *
   * @throws TranslatableException (404, SKILL_EXAM_NOT_FOUND).
   */
  getDetail(examId: string): Promise<SkillExamDetailResponseDto>;

  /**
   * Upserts a single answer. Idempotent — re-submitting overwrites. Allowed
   * only while the exam status is `IN_PROGRESS`.
   *
   * @throws TranslatableException (404, SKILL_EXAM_NOT_FOUND).
   * @throws TranslatableException (409, SKILL_EXAM_INVALID_STATUS).
   */
  submitAnswer(examId: string, dto: SubmitSkillExamAnswerDto): Promise<void>;

  /**
   * Finalises the exam. Verifies all 20 answers are present, advances to
   * `SUBMITTED`, enqueues `RUN_SKILL_EXAM_COPYLEAKS`, and emits the
   * `CONSULTANT_SKILL_EXAM_SUBMITTED` notification event.
   *
   * @throws TranslatableException (404, SKILL_EXAM_NOT_FOUND).
   * @throws TranslatableException (409, SKILL_EXAM_INVALID_STATUS).
   * @throws TranslatableException (422, SKILL_EXAM_INCOMPLETE_ANSWERS).
   */
  submit(examId: string): Promise<void>;
}
