import type { Order } from '@plys/libraries/common-nest/dto/page-options.dto';
import type { UserRole } from '@plys/libraries/database/enums';

/**
 * camelCase TS-internal shape of the admin allow-list list query.
 * The HTTP contract is snake_case — `@Expose({ name: '…' })` on the DTO
 * maps `is_active` to the camelCase property during transformation.
 */
export interface IListAdminAllowedEmailsRequest {
  readonly page: number;
  readonly limit: number;
  readonly sort_by?: string;
  readonly order_by?: Order;
  readonly isActive?: boolean;
  readonly keywords?: string;
  readonly role?: UserRole.ADMIN_PLATFORM | UserRole.TASK_REVIEWER;
}
