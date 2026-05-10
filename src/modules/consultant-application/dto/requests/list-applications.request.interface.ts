import { ApplicationStatus } from '@database/enums';

export interface IListApplicationsRequest {
  readonly status?: ApplicationStatus;
  readonly keyword?: string;
  readonly page: number;
  readonly take: number;
}
