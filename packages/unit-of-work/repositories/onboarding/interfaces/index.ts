import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import {
  ConsultantOnboarding,
  ConsultantOnboardingAnswer,
  OnboardingQuestion,
} from '@plys/libraries/database/entities';

export interface IConsultantOnboardingRepository extends AbstractRepository<ConsultantOnboarding> {
  findByUserId(userId: string): Promise<ConsultantOnboarding | null>;
  /**
   * Counts consultant onboardings sitting in the admin review queue —
   * `status = INTERVIEW_SUBMITTED`. Used by the admin dashboard.
   */
  countPendingReview(): Promise<number>;
}

export interface IConsultantOnboardingAnswerRepository extends AbstractRepository<ConsultantOnboardingAnswer> {
  findByOnboardingId(onboardingId: string): Promise<ConsultantOnboardingAnswer[]>;
}

export interface IOnboardingQuestionRepository extends AbstractRepository<OnboardingQuestion> {
  /** All active, non-soft-deleted questions ordered by position ASC. No pagination. */
  findAllActiveOrdered(): Promise<OnboardingQuestion[]>;

  /**
   * Paginated list of inactive (is_active = false), non-soft-deleted questions.
   * Sorted by most-recently updated.
   */
  findInactivePaginated(params: {
    skip: number;
    take: number;
  }): Promise<{ items: OnboardingQuestion[]; total: number }>;

  /** Largest position currently assigned to an active question (0 when none). */
  findMaxActivePosition(): Promise<number>;

  /**
   * Reorder the active set: set position to its index+1 for every id, in one transaction.
   * Caller has verified that orderedIds matches the active set exactly. The
   * transactional manager is provided via withManager() before this call.
   */
  reorderActive(orderedIds: readonly string[]): Promise<void>;

  /**
   * Sets the given id's position to NULL, then compacts the remaining active rows
   * so positions are 1..N contiguous. Caller must ensure the id is currently active.
   * The transactional manager is provided via withManager() before this call.
   */
  detachAndCompact(id: string): Promise<void>;

  /** Test helper / admin helper — count of currently active, non-deleted questions. */
  countActive(): Promise<number>;
}
