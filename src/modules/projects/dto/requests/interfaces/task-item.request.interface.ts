import { TaskDifficulty } from '@database/enums';

export interface ITaskItemRequest {
  title: string;
  description?: string;
  price: number;
  difficultyLevel?: TaskDifficulty;
  displayOrder?: number;
}
