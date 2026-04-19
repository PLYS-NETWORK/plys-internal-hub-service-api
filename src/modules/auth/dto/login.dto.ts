import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsString } from 'class-validator';

import { ActivePlatform } from '../../../database/enums/active-platform.enum';

export class LoginDto {
  @ApiProperty({ name: 'email', example: 'john@example.com' })
  @IsEmail()
  readonly email!: string;

  @ApiProperty({ name: 'password', example: 'P@ssword123' })
  @IsString()
  readonly password!: string;

  @ApiProperty({ name: 'active_platform', enum: ActivePlatform, example: ActivePlatform.BUSINESS })
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj['active_platform'])
  @IsEnum(ActivePlatform)
  readonly activePlatform!: ActivePlatform;
}
