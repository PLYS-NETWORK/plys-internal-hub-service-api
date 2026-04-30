export enum ProjectActivityEventType {
  TASK_STATUS_CHANGED = 'task_status_changed',
  APPLICATION_RECEIVED = 'application_received',
  APPLICATION_APPROVED = 'application_approved',
  APPLICATION_REJECTED = 'application_rejected',
  MEMBER_JOINED = 'member_joined',
  PROJECT_STATUS_CHANGED = 'project_status_changed',
}

export const PROJECT_ACTIVITY_EVENT_TYPES: readonly ProjectActivityEventType[] = [
  ProjectActivityEventType.TASK_STATUS_CHANGED,
  ProjectActivityEventType.APPLICATION_RECEIVED,
  ProjectActivityEventType.APPLICATION_APPROVED,
  ProjectActivityEventType.APPLICATION_REJECTED,
  ProjectActivityEventType.MEMBER_JOINED,
  ProjectActivityEventType.PROJECT_STATUS_CHANGED,
];
