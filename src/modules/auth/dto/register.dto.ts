import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsString, Matches, MinLength } from 'class-validator';

import { ActivePlatform } from '../../../database/enums/active-platform.enum';

export class RegisterDto {
  @ApiProperty({ name: 'email', example: 'john@example.com' })
  @IsEmail()
  readonly email!: string;

  @ApiProperty({ name: 'password', example: 'P@ssword123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
  })
  readonly password!: string;

  @ApiProperty({ name: 'first_name', example: 'John' })
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj['first_name'])
  @IsString()
  readonly firstName!: string;

  @ApiProperty({ name: 'last_name', example: 'Doe' })
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj['last_name'])
  @IsString()
  readonly lastName!: string;

  @ApiProperty({ name: 'active_platform', enum: ActivePlatform, example: ActivePlatform.BUSINESS })
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj['active_platform'])
  @IsEnum(ActivePlatform)
  readonly activePlatform!: ActivePlatform;
}
