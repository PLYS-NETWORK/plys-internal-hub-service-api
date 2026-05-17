import { ProjectStatus } from '@database/enums';

export interface IConsultantWorkspaceListItemResponse {
  readonly id: string;
  readonly title: string;
  readonly code: string;
  readonly status: ProjectStatus;
}
