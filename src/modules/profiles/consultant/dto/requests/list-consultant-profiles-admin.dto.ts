import { PageOptionsDto } from '@common/dto/page-options.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

import { IListConsultantProfilesAdminRequest } from './interfaces/list-consultant-profiles-admin.request.interface';

/**
 * Whitelist of `sort_by` values accepted by `GET /admin/consultant-profiles`.
 * The service rejects anything outside this list before building SQL — keeps
 * raw query strings out of `ORDER BY`.
 */
export const ADMIN_CONSULTANT_PROFILE_SORTABLE = ['created_at', 'updated_at', 'full_name'] as const;
export type AdminConsultantProfileSortable = (typeof ADMIN_CONSULTANT_PROFILE_SORTABLE)[number];

// Query-param strings ("true"/"false") need to coerce to booleans before
// @IsBoolean runs. Anything that isn't a recognised stringified-bool falls
// through unchanged so the validator can produce a precise error.
const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return value;
};

export class ListConsultantProfilesAdminDto
  extends PageOptionsDto
  implements IListConsultantProfilesAdminRequest
{
  @ApiPropertyOptional({
    name: 'sort_by',
    enum: ADMIN_CONSULTANT_PROFILE_SORTABLE,
    description: 'Column to sort by. Defaults to `created_at`.',
  })
  @IsIn(ADMIN_CONSULTANT_PROFILE_SORTABLE)
  @IsOptional()
  public override readonly sort_by?: AdminConsultantProfileSortable;

  @Expose({ name: 'has_notification_priority' })
  @ApiPropertyOptional({
    name: 'has_notification_priority',
    type: Boolean,
    description: 'Filter to consultants flagged for notification priority (true) or not (false).',
  })
  @Transform(toBoolean)
  @IsBoolean()
  @IsOptional()
  public readonly hasNotificationPriority?: boolean;
}
