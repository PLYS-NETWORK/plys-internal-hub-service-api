import { ApplicationStatus } from '@database/enums';

export interface IApplicationStatusResponse {
  readonly id: string;
  readonly status: ApplicationStatus;
  readonly blocked_until: string | null;
  readonly created_at: string;
}
