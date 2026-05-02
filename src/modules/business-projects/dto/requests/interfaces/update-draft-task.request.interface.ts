import { TaskDifficulty } from '@database/enums';

export interface IUpdateDraftTaskRequest {
  title?: string;
  description?: Record<string, unknown> | null;
  price?: string;
  difficultyLevel?: TaskDifficulty;
}
