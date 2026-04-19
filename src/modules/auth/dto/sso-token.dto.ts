import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsString } from 'class-validator';

import { ActivePlatform } from '../../../database/enums/active-platform.enum';

export class SsoTokenDto {
  @ApiProperty({ name: 'id_token', description: 'Google ID token from client-side auth' })
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj['id_token'])
  @IsString()
  readonly idToken!: string;

  @ApiProperty({ name: 'active_platform', enum: ActivePlatform, example: ActivePlatform.BUSINESS })
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj['active_platform'])
  @IsEnum(ActivePlatform)
  readonly activePlatform!: ActivePlatform;
}
