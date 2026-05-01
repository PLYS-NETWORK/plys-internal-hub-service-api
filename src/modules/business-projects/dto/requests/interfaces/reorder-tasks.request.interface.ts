import { TaskKanbanStatus } from '@database/enums';

export interface ITaskOrderItem {
  taskId: string;
  displayOrder: number;
}

export interface IReorderTasksRequest {
  currentStatus: TaskKanbanStatus;
  tasks: ITaskOrderItem[];
}
