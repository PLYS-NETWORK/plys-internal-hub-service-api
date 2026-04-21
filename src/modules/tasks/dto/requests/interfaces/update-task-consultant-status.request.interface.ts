import { TaskKanbanStatus } from '@database/enums/task-kanban-status.enum';

export interface IUpdateTaskConsultantStatusRequest {
  readonly status: TaskKanbanStatus;
}
