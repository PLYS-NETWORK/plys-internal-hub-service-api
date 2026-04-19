import { ActivePlatform } from '@database/enums/active-platform.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEmail, IsIn } from 'class-validator';

import { IResendVerificationRequest } from './interfaces/resend-verification.request.interface';

// ADMIN accounts are not self-registered, so resend is only relevant for
// BUSINESS and CONSULTANT platforms.
const SELF_REGISTERABLE_PLATFORMS: readonly ActivePlatform[] = [
  ActivePlatform.BUSINESS,
  ActivePlatform.CONSULTANT,
];

export class ResendVerificationDto implements IResendVerificationRequest {
  @Expose()
  @ApiProperty({ name: 'email', example: 'john@example.com' })
  @IsEmail()
  public readonly email!: string;

  @Expose()
  @ApiProperty({
    name: 'active_platform',
    enum: SELF_REGISTERABLE_PLATFORMS,
    example: ActivePlatform.BUSINESS,
  })
  @IsIn(SELF_REGISTERABLE_PLATFORMS)
  public readonly active_platform!: ActivePlatform;
}
