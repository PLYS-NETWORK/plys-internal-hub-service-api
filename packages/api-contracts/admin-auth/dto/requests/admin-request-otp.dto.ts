import { ApiProperty } from '@nestjs/swagger';
import { ActivePlatform } from '@plys/libraries/database/enums';
import { Expose } from 'class-transformer';
import { Equals, IsEmail, IsEnum } from 'class-validator';

import { IAdminRequestOtpRequest } from './interfaces';

export class AdminRequestOtpDto implements IAdminRequestOtpRequest {
  @Expose({ name: 'email' })
  @ApiProperty({ name: 'email', example: 'admin@plysnetwork.com' })
  @IsEmail()
  public readonly email!: string;

  @Expose({ name: 'active_platform' })
  @ApiProperty({
    name: 'active_platform',
    enum: [ActivePlatform.ADMIN_PLATFORM],
    example: ActivePlatform.ADMIN_PLATFORM,
  })
  @IsEnum(ActivePlatform)
  @Equals(ActivePlatform.ADMIN_PLATFORM, {
    message: 'active_platform must be admin_platform',
  })
  public readonly activePlatform!: ActivePlatform.ADMIN_PLATFORM;
}
