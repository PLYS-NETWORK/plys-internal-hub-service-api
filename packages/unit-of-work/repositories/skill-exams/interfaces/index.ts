import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import {
  ConsultantSkillExam,
  ConsultantSkillExamAnswer,
  ConsultantSkillExamQuestion,
} from '@plys/libraries/database/entities';

export interface IConsultantSkillExamRepository extends AbstractRepository<ConsultantSkillExam> {
  countInProgressByConsultant(consultantId: string): Promise<number>;
  findLatestByConsultantAndSkill(
    consultantId: string,
    skillId: string,
  ): Promise<ConsultantSkillExam | null>;
  findByConsultant(consultantId: string): Promise<ConsultantSkillExam[]>;
  countAttemptsByConsultantAndSkill(consultantId: string, skillId: string): Promise<number>;
  /** Returns the consultant's single non-terminal exam (any status in SKILL_EXAM_IN_PROGRESS_STATUSES), or null. */
  findCurrentByConsultant(consultantId: string): Promise<ConsultantSkillExam | null>;
  /** Returns IN_PROGRESS exams whose deadline has passed. Used by the 5-min sweep. */
  findExpiredInProgress(limit: number): Promise<ConsultantSkillExam[]>;
  /**
   * Counts exams currently in admin-actionable states — `SUBMITTED` (awaiting
   * the automated CopyLeaks+AI pipeline) and `COPYLEAKS_FAILED` (terminal
   * provider failure that needs a manual retry). Used by the admin dashboard
   * operational-queues card.
   */
  countAwaitingReview(): Promise<number>;
  /**
   * Same as {@link findCurrentByConsultant} but with `skill` eagerly loaded so
   * the consultant dashboard can render `active_skill_name` without a second
   * round-trip.
   */
  findActiveByConsultantIdWithSkill(consultantId: string): Promise<ConsultantSkillExam | null>;
  /**
   * Total exams that reached the `PASSED` terminal status for a consultant.
   * Source for the dashboard summary `exams.total_passed_skills`.
   */
  countPassedByConsultantId(consultantId: string): Promise<number>;
  /**
   * PASSED-exam counts grouped by `skill_id` for one consultant. Skills with
   * zero passes are absent from the map. Powers skill-performance
   * `total_passed_exams`.
   */
  countPassedByConsultantGroupedBySkill(consultantId: string): Promise<Map<string, number>>;
}

export interface IConsultantSkillExamQuestionRepository extends AbstractRepository<ConsultantSkillExamQuestion> {
  findByExamId(examId: string): Promise<ConsultantSkillExamQuestion[]>;
}

export interface IConsultantSkillExamAnswerRepository extends AbstractRepository<ConsultantSkillExamAnswer> {
  findByExamId(examId: string): Promise<ConsultantSkillExamAnswer[]>;
}
