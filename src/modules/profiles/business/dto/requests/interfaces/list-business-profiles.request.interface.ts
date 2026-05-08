import type { Order } from '@common/dto/page-options.dto';

/**
 * camelCase TS-internal shape of the admin business-profiles list query.
 * The HTTP contract is snake_case — `@Expose({ name: '…' })` on the DTO
 * maps `is_partner_platform`/`is_verified` query params to these camelCase
 * properties during `class-transformer`'s plainToInstance pass.
 */
export interface IListBusinessProfilesRequest {
  readonly page: number;
  readonly limit: number;
  readonly sort_by?: string;
  readonly order_by?: Order;
  readonly isPartnerPlatform?: boolean;
  readonly isVerified?: boolean;
}
