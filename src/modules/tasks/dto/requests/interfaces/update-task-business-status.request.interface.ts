import { TaskKanbanStatus } from '@database/enums/task-kanban-status.enum';

export interface IUpdateTaskBusinessStatusRequest {
  readonly status: TaskKanbanStatus;
}
