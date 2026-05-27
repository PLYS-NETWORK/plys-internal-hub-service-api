import { AdminUsersBreakdownResponseDto } from '../../dto/responses/admin-users-breakdown-response.dto';

/**
 * Contract for the standalone users-breakdown endpoint at
 * `/admin/dashboard/users-breakdown`. Same matrix the summary endpoint
 * surfaces inline; exposed separately so the FE drill-in panels can request
 * it without paying for the full summary fan-out.
 */
export interface IAdminUsersBreakdownService {
  /** Returns the per-platform x per-status user counts. */
  get(): Promise<AdminUsersBreakdownResponseDto>;
}
