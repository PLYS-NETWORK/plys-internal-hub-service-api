import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@plys/libraries/database/enums';
import { Expose } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, MaxLength } from 'class-validator';

import { IInviteAdminEmailRequest } from './interfaces/invite-admin-email.request.interface';

// Exported so the list-filter DTO can reuse the same allow-list — a new
// invitable role automatically becomes a valid filter value.
export const INVITABLE_ROLES: ReadonlyArray<UserRole.ADMIN_PLATFORM | UserRole.TASK_REVIEWER> = [
  UserRole.ADMIN_PLATFORM,
  UserRole.TASK_REVIEWER,
];

export class InviteAdminEmailDto implements IInviteAdminEmailRequest {
  @Expose({ name: 'email' })
  @ApiProperty({ name: 'email', example: 'newadmin@plysnetwork.com' })
  @IsEmail()
  @MaxLength(255)
  public readonly email!: string;

  @Expose({ name: 'role' })
  @ApiPropertyOptional({
    name: 'role',
    enum: INVITABLE_ROLES,
    example: UserRole.TASK_REVIEWER,
    description: 'Role assigned at first OTP login. Defaults to ADMIN_PLATFORM when omitted.',
  })
  @IsOptional()
  @IsIn(INVITABLE_ROLES as ReadonlyArray<string>)
  public readonly role?: UserRole.ADMIN_PLATFORM | UserRole.TASK_REVIEWER;
}
