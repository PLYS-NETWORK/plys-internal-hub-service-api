import { PageOptionsDto } from '@common/dto/page-options.dto';
import { UserRole } from '@database/enums';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { IListAdminAllowedEmailsRequest } from './interfaces/list-admin-allowed-emails.request.interface';
import { INVITABLE_ROLES } from './invite-admin-email.dto';

/**
 * Whitelist of `sort_by` values accepted by `GET /admin/allowed-emails`.
 * The service rejects anything outside this list before building SQL.
 */
export const ADMIN_ALLOWED_EMAIL_SORTABLE = ['created_at', 'email'] as const;
export type AdminAllowedEmailSortable = (typeof ADMIN_ALLOWED_EMAIL_SORTABLE)[number];

const KEYWORDS_MIN = 1;
const KEYWORDS_MAX = 80;

// Query-param strings ("true"/"false") need to coerce to booleans before
// @IsBoolean runs. Anything that isn't a recognised stringified-bool falls
// through unchanged so the validator can produce a precise error.
const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return value;
};

export class ListAdminAllowedEmailsDto
  extends PageOptionsDto
  implements IListAdminAllowedEmailsRequest
{
  @ApiPropertyOptional({
    name: 'sort_by',
    enum: ADMIN_ALLOWED_EMAIL_SORTABLE,
    description: 'Column to sort by. Defaults to `created_at`.',
  })
  @IsIn(ADMIN_ALLOWED_EMAIL_SORTABLE)
  @IsOptional()
  public override readonly sort_by?: AdminAllowedEmailSortable;

  @Expose({ name: 'is_active' })
  @ApiPropertyOptional({
    name: 'is_active',
    type: Boolean,
    description: 'Filter to active (true) or revoked (false) entries.',
  })
  @Transform(toBoolean)
  @IsBoolean()
  @IsOptional()
  public readonly isActive?: boolean;

  @Expose({ name: 'keywords' })
  @ApiPropertyOptional({
    name: 'keywords',
    description: 'Case-insensitive substring match on `email`.',
    minLength: KEYWORDS_MIN,
    maxLength: KEYWORDS_MAX,
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(KEYWORDS_MIN)
  @MaxLength(KEYWORDS_MAX)
  @IsOptional()
  public readonly keywords?: string;

  @Expose({ name: 'role' })
  @ApiPropertyOptional({
    name: 'role',
    enum: INVITABLE_ROLES,
    description: 'Exact-match filter on the row role. Only invitable roles are accepted.',
  })
  @IsIn(INVITABLE_ROLES as ReadonlyArray<string>)
  @IsOptional()
  public readonly role?: UserRole.ADMIN_PLATFORM | UserRole.TASK_REVIEWER;
}
