import { TaskDifficulty } from '@database/enums/task-difficulty.enum';

export interface ITaskItemRequest {
  title: string;
  description?: string;
  price: number;
  difficultyLevel?: TaskDifficulty;
  displayOrder?: number;
}
