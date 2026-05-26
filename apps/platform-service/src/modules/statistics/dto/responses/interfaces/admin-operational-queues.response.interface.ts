import { IAdminOperationalQueuesSummary } from './admin-dashboard-summary.response.interface';

/**
 * Standalone operational-queues response exposed at
 * `/admin/dashboard/operational-queues`. Same counts the summary endpoint
 * carries, plus an ISO timestamp for cache-busting on the FE side.
 */
export interface IAdminOperationalQueuesResponse {
  counts: IAdminOperationalQueuesSummary;
  generated_at: string;
}
