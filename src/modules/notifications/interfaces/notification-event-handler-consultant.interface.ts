import {
  IConsultantAccountBannedEvent,
  IConsultantOnboardingApprovedEvent,
  IConsultantOnboardingRejectedEvent,
  IConsultantProjectJoinedEvent,
  IConsultantSkillExamFailedEvent,
  IConsultantSkillExamPassedEvent,
  IConsultantSkillExamSubmittedEvent,
  IProjectPublishedEvent,
  ITaskStatusChangedEvent,
} from '@common/events';

export interface IConsultantNotificationEventHandlerService {
  /**
   * Enqueues a skill-match fan-out job that dispatches
   * `CONSULTANT_PROJECT_SKILL_MATCH` to all consultants whose skills overlap
   * with the published project's required skills.
   * Uses a Bull queue to avoid blocking the publish flow when N is large.
   * @param event Payload carrying project details and the list of required skill IDs.
   */
  onConsultantProjectSkillMatch(event: IProjectPublishedEvent): Promise<void>;

  /**
   * Sends `CONSULTANT_PROJECT_JOINED` to the consultant when they are
   * successfully added as a member of a project.
   * @param event Payload carrying project identity and the consultant's userId.
   */
  onConsultantProjectJoined(event: IConsultantProjectJoinedEvent): Promise<void>;

  /**
   * Sends `CONSULTANT_TASK_STATUS_CHANGED` to the assigned consultant when
   * the kanban status of one of their tasks is updated.
   * @param event Payload carrying old and new status values alongside task identity.
   */
  onConsultantTaskStatusChanged(event: ITaskStatusChangedEvent): Promise<void>;

  /**
   * Sends `CONSULTANT_ONBOARDING_APPROVED` to the consultant when an admin
   * approves their onboarding application (`OnboardingStatus → APPROVED`).
   * @param event Payload carrying the consultant's userId and the onboarding row id.
   */
  onConsultantOnboardingApproved(event: IConsultantOnboardingApprovedEvent): Promise<void>;

  /**
   * Sends `CONSULTANT_ONBOARDING_REJECTED` to the consultant when an admin
   * rejects their onboarding (`OnboardingStatus → REJECTED`). Pair with the
   * rejection email; the consultant is also blocked from re-onboarding for 3 months.
   * @param event Payload carrying the rejection note + when the 3-month block lifts.
   */
  onConsultantOnboardingRejected(event: IConsultantOnboardingRejectedEvent): Promise<void>;

  /**
   * Sends `CONSULTANT_SKILL_EXAM_SUBMITTED` to the consultant immediately after
   * they finalise a skill-exam attempt (`status → SUBMITTED`).
   * @param event Payload carrying exam + skill identity for routing.
   */
  onConsultantSkillExamSubmitted(event: IConsultantSkillExamSubmittedEvent): Promise<void>;

  /**
   * Sends `CONSULTANT_SKILL_EXAM_FAILED` to the consultant when the skill-exam
   * pipeline concludes in `FAILED` (AI eval < 80%), `COPYLEAKS_FAILED`
   * (AI-content flagged), or `EXPIRED` (60-min deadline elapsed).
   * `metadata.fail_reason` discriminates the three cases.
   * @param event Payload carrying the score, cooldown timestamp, and strike state.
   */
  onConsultantSkillExamFailed(event: IConsultantSkillExamFailedEvent): Promise<void>;

  /**
   * Sends `CONSULTANT_SKILL_EXAM_PASSED` to the consultant when the skill-exam
   * pipeline concludes in `PASSED` (AI eval ≥ 80%). Copy is keyed off
   * `metadata.proficiency_level` (`'senior'` vs `'expert'`).
   * @param event Payload carrying final score and assigned proficiency.
   */
  onConsultantSkillExamPassed(event: IConsultantSkillExamPassedEvent): Promise<void>;

  /**
   * Sends `CONSULTANT_ACCOUNT_BANNED` to the consultant when the 3rd Copyleaks
   * strike flips `User.isActive = false`. Fires AFTER the corresponding
   * `CONSULTANT_SKILL_EXAM_FAILED` notification for the same exam.
   * @param event Payload carrying the ban reason and timestamp.
   */
  onConsultantAccountBanned(event: IConsultantAccountBannedEvent): Promise<void>;
}
