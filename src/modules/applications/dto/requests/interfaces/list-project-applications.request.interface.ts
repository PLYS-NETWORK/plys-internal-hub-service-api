import { ApplicationStatus } from '@database/enums/application-status.enum';

export interface IListProjectApplicationsRequest {
  readonly status?: ApplicationStatus;
}
