export interface IReorderTaskItemRequest {
  id: string;
  displayOrder: number;
}

export interface IReorderTasksRequest {
  tasks: IReorderTaskItemRequest[];
}
