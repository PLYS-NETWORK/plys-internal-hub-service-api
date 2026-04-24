import { ApplicationStatus } from '@database/enums';

export interface IListProjectApplicationsRequest {
  readonly status?: ApplicationStatus;
}
