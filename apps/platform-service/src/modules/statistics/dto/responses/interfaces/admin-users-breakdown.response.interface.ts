import { IAdminUsersStatusCounts } from './admin-dashboard-summary.response.interface';

/**
 * Standalone version of the users-by-platform-by-status matrix exposed at
 * `/admin/dashboard/users-breakdown`. Same shape as
 * [[admin-dashboard-summary.response.interface]] `users` block.
 */
export interface IAdminUsersBreakdownResponse {
  business: IAdminUsersStatusCounts;
  consultant: IAdminUsersStatusCounts;
}
