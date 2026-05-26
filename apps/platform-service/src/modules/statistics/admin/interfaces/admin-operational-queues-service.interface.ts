import { AdminOperationalQueuesResponseDto } from '../../dto/responses/admin-operational-queues-response.dto';

/**
 * Contract for the operational-queues endpoint. Counts surfacing items that
 * need human attention — pending onboardings, exams awaiting review, open
 * disputes, overdue invoices, pending withdrawals. Cached for
 * {@link AdminDashboardCacheTtl.QUEUES} seconds.
 */
export interface IAdminOperationalQueuesService {
  /** Returns the queue counts plus a server-side timestamp. */
  get(): Promise<AdminOperationalQueuesResponseDto>;
}
