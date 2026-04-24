import { TaskKanbanStatus } from '@database/enums';

export interface IUpdateTaskConsultantStatusRequest {
  readonly status: TaskKanbanStatus;
}
