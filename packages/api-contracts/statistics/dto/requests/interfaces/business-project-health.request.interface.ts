import { ProjectStatus } from '@plys/libraries/database/enums';

export interface IBusinessProjectHealthRequest {
  /** Optional single-status filter; defaults to the active set (PUBLISHED + IN_PROGRESS). */
  status?: ProjectStatus;
  /** Max rows in the response. Default 20, max 50. */
  limit: number;
}
