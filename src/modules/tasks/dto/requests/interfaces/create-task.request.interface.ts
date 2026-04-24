import { TaskDifficulty } from '@database/enums';

export interface ICreateTaskRequest {
  readonly projectId: string;
  readonly title: string;
  readonly description?: string | null;
  readonly price: number;
  readonly difficultyLevel?: TaskDifficulty;
}
