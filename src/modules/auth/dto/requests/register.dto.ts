import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEmail, IsEnum, IsString, Matches, MinLength } from 'class-validator';

import { ActivePlatform } from '@database/enums/active-platform.enum';
import { IRegisterRequest } from './interfaces/register.request.interface';

export class RegisterDto implements IRegisterRequest {
  @Expose()
  @ApiProperty({ name: 'email', example: 'john@example.com' })
  @IsEmail()
  readonly email!: string;

  @Expose()
  @ApiProperty({ name: 'password', example: 'P@ssword123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
  })
  readonly password!: string;

  @Expose()
  @ApiProperty({ name: 'first_name', example: 'John' })
  @IsString()
  readonly first_name!: string;

  @Expose()
  @ApiProperty({ name: 'last_name', example: 'Doe' })
  @IsString()
  readonly last_name!: string;

  @Expose()
  @ApiProperty({ name: 'active_platform', enum: ActivePlatform, example: ActivePlatform.BUSINESS })
  @IsEnum(ActivePlatform)
  readonly active_platform!: ActivePlatform;
}
