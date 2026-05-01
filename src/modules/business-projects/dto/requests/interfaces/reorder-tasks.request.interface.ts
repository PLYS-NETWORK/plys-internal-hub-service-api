import { TaskKanbanStatus } from '@database/enums';

export interface ITaskOrderItem {
  id: string;
  displayOrder: number;
}

export interface IReorderTasksRequest {
  currentStatus: TaskKanbanStatus;
  tasks: ITaskOrderItem[];
}
