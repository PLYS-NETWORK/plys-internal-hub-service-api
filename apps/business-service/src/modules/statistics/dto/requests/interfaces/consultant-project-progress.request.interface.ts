import { ProjectStatus } from '@plys/libraries/database/enums';

export interface IConsultantProjectProgressRequest {
  /** Optional narrow to a single project status. */
  status?: ProjectStatus;
  /** Page size cap; default 20, server caps at 50. */
  limit: number;
}
