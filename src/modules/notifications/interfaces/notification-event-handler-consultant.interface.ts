import {
  IConsultantProjectJoinedEvent,
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
}
