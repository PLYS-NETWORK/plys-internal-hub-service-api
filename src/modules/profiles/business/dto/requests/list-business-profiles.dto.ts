import { PageOptionsDto } from '@common/dto/page-options.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

import { IListBusinessProfilesRequest } from './interfaces/list-business-profiles.request.interface';

/**
 * Whitelist of `sort_by` values accepted by `GET /admin/business-profiles`.
 * The service rejects anything outside this list before building SQL — keeps
 * raw query strings out of `ORDER BY`.
 */
export const ADMIN_BUSINESS_PROFILE_SORTABLE = [
  'created_at',
  'updated_at',
  'company_name',
] as const;
export type AdminBusinessProfileSortable = (typeof ADMIN_BUSINESS_PROFILE_SORTABLE)[number];

// Query-param strings ("true"/"false") need to coerce to booleans before
// @IsBoolean runs. Anything that isn't a recognised stringified-bool falls
// through unchanged so the validator can produce a precise error.
const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return value;
};

export class ListBusinessProfilesDto
  extends PageOptionsDto
  implements IListBusinessProfilesRequest
{
  @ApiPropertyOptional({
    name: 'sort_by',
    enum: ADMIN_BUSINESS_PROFILE_SORTABLE,
    description: 'Column to sort by. Defaults to `created_at`.',
  })
  @IsIn(ADMIN_BUSINESS_PROFILE_SORTABLE)
  @IsOptional()
  public override readonly sort_by?: AdminBusinessProfileSortable;

  @Expose({ name: 'is_partner_platform' })
  @ApiPropertyOptional({
    name: 'is_partner_platform',
    type: Boolean,
    description: 'Filter to partner-platform (true) or non-partner (false) businesses.',
  })
  @Transform(toBoolean)
  @IsBoolean()
  @IsOptional()
  public readonly isPartnerPlatform?: boolean;

  @Expose({ name: 'is_verified' })
  @ApiPropertyOptional({
    name: 'is_verified',
    type: Boolean,
    description: 'Filter to verified (true) or unverified (false) businesses.',
  })
  @Transform(toBoolean)
  @IsBoolean()
  @IsOptional()
  public readonly isVerified?: boolean;
}
