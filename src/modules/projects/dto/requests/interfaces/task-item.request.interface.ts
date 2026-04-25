import { TaskDifficulty } from '@database/enums';

export interface ITaskItemRequest {
  title: string;
  description?: Record<string, unknown>;
  price: number;
  difficultyLevel?: TaskDifficulty;
  displayOrder?: number;
}
