import { ApplicationStatus } from '@database/enums/application-status.enum';

export interface IListMyApplicationsRequest {
  readonly status?: ApplicationStatus;
}
