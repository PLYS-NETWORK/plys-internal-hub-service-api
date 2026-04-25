export enum ProjectStatus {
  DRAFT = 'draft',
  SETTING_UP = 'setting_up',
  CONFIGURED = 'configured',
  PUBLIC = 'public',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

export const PROJECT_STATUSES: readonly ProjectStatus[] = [
  ProjectStatus.DRAFT,
  ProjectStatus.SETTING_UP,
  ProjectStatus.CONFIGURED,
  ProjectStatus.PUBLIC,
  ProjectStatus.IN_PROGRESS,
  ProjectStatus.DONE,
  ProjectStatus.CANCELLED,
];
