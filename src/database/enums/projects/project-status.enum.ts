export enum ProjectStatus {
  DRAFT = 'draft',
  CONFIGURED = 'configured',
  PUBLISHED = 'published',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

export const PROJECT_STATUSES: readonly ProjectStatus[] = [
  ProjectStatus.DRAFT,
  ProjectStatus.CONFIGURED,
  ProjectStatus.PUBLISHED,
  ProjectStatus.IN_PROGRESS,
  ProjectStatus.DONE,
  ProjectStatus.CANCELLED,
];
