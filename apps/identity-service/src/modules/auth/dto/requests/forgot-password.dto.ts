import { ApiProperty } from '@nestjs/swagger';
import { ActivePlatform } from '@plys/libraries/database/enums';
import { Expose } from 'class-transformer';
import { IsEmail, IsIn } from 'class-validator';

import { IForgotPasswordRequest } from './interfaces/forgot-password.request.interface';

// Self-service password reset is only available on user-facing platforms.
// ADMIN passwords must be rotated via internal admin tooling so federated
// recovery cannot be used to escalate privileges.
const RECOVERABLE_PLATFORMS: readonly ActivePlatform[] = [
  ActivePlatform.BUSINESS,
  ActivePlatform.CONSULTANT,
];

export class ForgotPasswordDto implements IForgotPasswordRequest {
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
}
