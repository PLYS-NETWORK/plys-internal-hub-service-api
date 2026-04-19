import { ProjectStatus } from '@database/enums/project-status.enum';

export interface IUpdateProjectStatusRequest {
  status: ProjectStatus;
}
