import { ProjectStatus } from '@plys/libraries/database/enums';

export type ExploreProjectStatusFilter = ProjectStatus.PUBLISHED | ProjectStatus.IN_PROGRESS;

export interface IListExploreProjectsRequest {
  readonly skillIds?: string[];
  readonly title?: string;
  readonly status?: ExploreProjectStatusFilter;
}
