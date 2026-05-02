import { TaskKanbanStatus } from '@database/enums';

export interface IChangeTaskStatusRequest {
  kanbanStatus: TaskKanbanStatus;
}
