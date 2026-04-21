import { TaskDifficulty } from '@database/enums/task-difficulty.enum';

export interface ICreateTaskRequest {
  readonly projectId: string;
  readonly title: string;
  readonly description?: string | null;
  readonly price: number;
  readonly difficultyLevel?: TaskDifficulty;
}
