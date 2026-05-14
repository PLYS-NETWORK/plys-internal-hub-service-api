import { ActivePlatform } from '@database/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';

import { IRegisterRequest } from './interfaces/register.request.interface';

// Self-registration is only permitted for BUSINESS and CONSULTANT.
// ADMIN accounts are provisioned out-of-band (seeds/admin tooling); exposing
// `admin` here would let anyone create an admin user from the public endpoint.
const SELF_REGISTERABLE_PLATFORMS: readonly ActivePlatform[] = [
  ActivePlatform.BUSINESS,
  ActivePlatform.CONSULTANT,
];

export class RegisterDto implements IRegisterRequest {
  @Expose()
  @ApiProperty({ name: 'email', example: 'john@example.com' })
  @IsEmail()
  public readonly email!: string;

  @Expose()
  @ApiProperty({ name: 'password', example: 'P@ssword123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
  })
  public readonly password!: string;

  @Expose()
  @ApiProperty({
    name: 'active_platform',
    enum: SELF_REGISTERABLE_PLATFORMS,
    example: ActivePlatform.BUSINESS,
  })
  @IsIn(SELF_REGISTERABLE_PLATFORMS)
  public readonly active_platform!: ActivePlatform;

  // Required only when registering on the Business platform.
  @Expose()
  @ApiPropertyOptional({ name: 'company_name', example: 'Acme Inc.' })
  @ValidateIf((o: RegisterDto) => o.active_platform === ActivePlatform.BUSINESS)
  @IsString()
  @IsNotEmpty()
  public readonly company_name?: string;

  // Required when registering on the Business or Consultant platform.
  // For BUSINESS, this value is stored as the business owner's name on the
  // initial profile stub (`business_profiles.owner_name`).
  @Expose()
  @ApiPropertyOptional({ name: 'full_name', example: 'John Doe' })
  @ValidateIf(
    (o: RegisterDto) =>
      o.active_platform === ActivePlatform.BUSINESS ||
      o.active_platform === ActivePlatform.CONSULTANT,
  )
  @IsString()
  @IsNotEmpty()
  public readonly full_name?: string;
}
