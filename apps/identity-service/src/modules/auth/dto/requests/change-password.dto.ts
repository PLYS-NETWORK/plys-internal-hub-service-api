import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsString, Matches, MinLength } from 'class-validator';

import { IChangePasswordRequest } from './interfaces/change-password.request.interface';

export class ChangePasswordDto implements IChangePasswordRequest {
  @Expose()
  @ApiProperty({ name: 'current_password' })
  @IsString()
  public readonly current_password!: string;

  @Expose()
  @ApiProperty({ name: 'new_password', minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
  })
  public readonly new_password!: string;
}
