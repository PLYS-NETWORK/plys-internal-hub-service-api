import { ProjectMemberStatus } from '@plys/libraries/database/enums';

export interface IConsultantMembershipResponse {
  readonly project_id: string;
  readonly status: ProjectMemberStatus;
  readonly joined_at: Date;
  readonly left_at: Date | null;
}
