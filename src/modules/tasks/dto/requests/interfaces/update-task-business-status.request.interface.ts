import { TaskKanbanStatus } from '@database/enums';

export interface IUpdateTaskBusinessStatusRequest {
  readonly status: TaskKanbanStatus;
}
