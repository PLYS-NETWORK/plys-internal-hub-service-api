import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IUserResponse } from './interfaces/user-response.response.interface';

@Exclude()
export class UserResponseDto implements IUserResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ example: 'john@example.com' })
  public readonly email!: string;

  @Expose({ name: 'isEmailVerified' })
  @ApiProperty({ name: 'is_email_verified', example: true })
  public readonly is_email_verified!: boolean;

  @Expose({ name: 'isActive' })
  @ApiProperty({ name: 'is_active', example: true })
  public readonly is_active!: boolean;
}
