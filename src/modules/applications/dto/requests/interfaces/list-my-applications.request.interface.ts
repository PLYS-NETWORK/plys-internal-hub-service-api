import { ApplicationStatus } from '@database/enums';

export interface IListMyApplicationsRequest {
  readonly status?: ApplicationStatus;
}
