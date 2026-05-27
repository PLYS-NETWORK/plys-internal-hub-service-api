import { ApiProperty } from '@nestjs/swagger';
import { ActivePlatform } from '@plys/libraries/database/enums';
import { Expose } from 'class-transformer';
import { IsEmail, IsIn, IsString, Matches, MinLength } from 'class-validator';

import { IResetPasswordRequest } from './interfaces/reset-password.request.interface';

const RECOVERABLE_PLATFORMS: readonly ActivePlatform[] = [
  ActivePlatform.BUSINESS,
  ActivePlatform.CONSULTANT,
];

export class ResetPasswordDto implements IResetPasswordRequest {
  @Expose()
  @ApiProperty({ name: 'email', example: 'john@example.com' })
  @IsEmail()
  public readonly email!: string;

  @Expose({ name: 'active_platform' })
  @ApiProperty({
    name: 'active_platform',
    enum: RECOVERABLE_PLATFORMS,
    example: ActivePlatform.BUSINESS,
  })
  @IsIn(RECOVERABLE_PLATFORMS)
  public readonly activePlatform!: ActivePlatform;

  @Expose()
  @ApiProperty({ name: 'otp', example: '482931', description: '6-digit numeric OTP from email' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be a 6-digit numeric code' })
  public readonly otp!: string;

  @Expose({ name: 'new_password' })
  @ApiProperty({ name: 'new_password', example: 'P@ssword123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
  })
  public readonly newPassword!: string;
}
