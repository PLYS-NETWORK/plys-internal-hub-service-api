import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';

import { IInviteAdminEmailRequest } from './interfaces/invite-admin-email.request.interface';

export class InviteAdminEmailDto implements IInviteAdminEmailRequest {
  @Expose({ name: 'email' })
  @ApiProperty({ name: 'email', example: 'newadmin@plysnetwork.com' })
  @IsEmail()
  @MaxLength(255)
  public readonly email!: string;
}
