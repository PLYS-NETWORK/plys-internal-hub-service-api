export enum ProjectActivityEventType {
  TASK_STATUS_CHANGED = 'task_status_changed',
  MEMBER_JOINED = 'member_joined',
  PROJECT_STATUS_CHANGED = 'project_status_changed',
}

export const PROJECT_ACTIVITY_EVENT_TYPES: readonly ProjectActivityEventType[] = [
  ProjectActivityEventType.TASK_STATUS_CHANGED,
  ProjectActivityEventType.MEMBER_JOINED,
  ProjectActivityEventType.PROJECT_STATUS_CHANGED,
];
