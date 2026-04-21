export enum TaskKanbanStatus {
  DRAFT = 'draft',
  TO_DO = 'to_do',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  IN_REVIEW = 'in_review',
  PENDING_APPROVAL = 'pending_approval',
  REVISION_REQUESTED = 'revision_requested',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

export const TASK_KANBAN_STATUSES: readonly TaskKanbanStatus[] = [
  TaskKanbanStatus.DRAFT,
  TaskKanbanStatus.TO_DO,
  TaskKanbanStatus.ASSIGNED,
  TaskKanbanStatus.IN_PROGRESS,
  TaskKanbanStatus.IN_REVIEW,
  TaskKanbanStatus.PENDING_APPROVAL,
  TaskKanbanStatus.REVISION_REQUESTED,
  TaskKanbanStatus.DONE,
  TaskKanbanStatus.CANCELLED,
];
