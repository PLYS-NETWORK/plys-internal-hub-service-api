import { ProjectStatus } from '@plys/libraries/database/enums';

export type ConsultantExploreStatusFilter = ProjectStatus.PUBLISHED | ProjectStatus.IN_PROGRESS;

export interface IListConsultantExploreProjectsRequest {
  readonly title?: string;
  readonly status?: ConsultantExploreStatusFilter;
}
