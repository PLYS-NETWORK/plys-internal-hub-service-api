import { TaskDifficulty } from '@database/enums';

export interface ICreateTaskRequest {
  readonly projectId: string;
  readonly title: string;
  readonly description?: Record<string, unknown> | null;
  readonly price: number;
  readonly difficultyLevel?: TaskDifficulty;
}
