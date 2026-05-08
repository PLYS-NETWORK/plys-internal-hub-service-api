import { ActivePlatform } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { Equals, IsEmail, IsEnum, IsString, Length, Matches } from 'class-validator';

import { IAdminVerifyOtpRequest } from './interfaces';

export class AdminVerifyOtpDto implements IAdminVerifyOtpRequest {
  @Expose({ name: 'email' })
  @ApiProperty({ name: 'email', example: 'admin@plysnetwork.com' })
  @IsEmail()
  public readonly email!: string;

  @Expose({ name: 'otp' })
  @ApiProperty({ name: 'otp', example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'otp must be a 6-digit number' })
  public readonly otp!: string;

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
