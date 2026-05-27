import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

import { ISsoExchangeRequest } from './interfaces/sso-exchange.request.interface';

export class SsoExchangeDto implements ISsoExchangeRequest {
  @Expose()
  @ApiProperty({
    name: 'code',
    description: 'Single-use code returned by /auth/sso/google/callback',
    example: 'BJfQg7…',
    minLength: 16,
    maxLength: 128,
  })
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  public readonly code!: string;
}
