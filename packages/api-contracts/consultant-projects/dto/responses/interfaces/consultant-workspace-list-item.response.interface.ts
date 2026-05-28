import { ProjectStatus } from '@plys/libraries/database/enums';

export interface IConsultantWorkspaceListItemResponse {
  readonly id: string;
  readonly title: string;
  readonly code: string;
  readonly status: ProjectStatus;
}
