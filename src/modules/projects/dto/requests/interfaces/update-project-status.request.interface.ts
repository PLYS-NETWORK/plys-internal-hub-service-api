import { ProjectStatus } from '@database/enums';

export interface IUpdateProjectStatusRequest {
  status: ProjectStatus;
}
