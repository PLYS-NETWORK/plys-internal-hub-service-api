import { ActivePlatform } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEnum, IsString } from 'class-validator';

import { ISsoTokenRequest } from './interfaces/sso-token.request.interface';

export class SsoTokenDto implements ISsoTokenRequest {
  @Expose()
  @ApiProperty({ name: 'id_token', description: 'Google ID token from client-side auth' })
  @IsString()
  public readonly id_token!: string;

  @Expose()
  @ApiProperty({ name: 'active_platform', enum: ActivePlatform, example: ActivePlatform.BUSINESS })
  @IsEnum(ActivePlatform)
  public readonly active_platform!: ActivePlatform;
}
