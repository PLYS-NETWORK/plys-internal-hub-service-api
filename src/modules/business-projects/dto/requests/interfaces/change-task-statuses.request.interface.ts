import { TaskKanbanStatus } from '@database/enums';

export interface ITaskStatusItem {
  taskId: string;
  kanbanStatus: TaskKanbanStatus;
}

export interface IChangeTaskStatusesRequest {
  tasks: ITaskStatusItem[];
}
