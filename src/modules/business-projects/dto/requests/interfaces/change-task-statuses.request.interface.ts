import { TaskKanbanStatus } from '@database/enums';

export interface ITaskStatusItem {
  id: string;
  kanbanStatus: TaskKanbanStatus;
}

export interface IChangeTaskStatusesRequest {
  tasks: ITaskStatusItem[];
}
