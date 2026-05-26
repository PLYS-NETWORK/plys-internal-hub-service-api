import { ApiProperty } from '@nestjs/swagger';
import { ActivePlatform } from '@plys/libraries/database/enums';
import { Expose } from 'class-transformer';
import { IsEmail, IsEnum, IsString } from 'class-validator';

import { ILoginRequest } from './interfaces/login.request.interface';

export class LoginDto implements ILoginRequest {
  @Expose()
  @ApiProperty({ name: 'email', example: 'john@example.com' })
  @IsEmail()
  public readonly email!: string;

  @Expose()
  @ApiProperty({ name: 'password', example: 'P@ssword123' })
  @IsString()
  public readonly password!: string;

  @Expose()
  @ApiProperty({ name: 'active_platform', enum: ActivePlatform, example: ActivePlatform.BUSINESS })
  @IsEnum(ActivePlatform)
  public readonly active_platform!: ActivePlatform;
}
