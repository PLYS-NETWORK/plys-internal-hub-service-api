import { IProjectMemberOverviewResponse } from './project-member-overview.response.interface';

export interface IProjectMembersOverviewResponse {
  project_id: string;
  total_members: number;
  pending_approval_count: number;
  members: IProjectMemberOverviewResponse[];
}
