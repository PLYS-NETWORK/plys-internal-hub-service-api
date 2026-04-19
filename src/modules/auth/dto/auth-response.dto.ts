import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import { UserResponseDto } from './user-response.dto';

@Exclude()
export class AuthResponseDto {
  @Expose({ name: 'access_token' })
  @ApiProperty({ name: 'access_token' })
  readonly accessToken!: string;

  @Expose({ name: 'refresh_token' })
  @ApiProperty({ name: 'refresh_token' })
  readonly refreshToken!: string;

  @Expose({ name: 'expires_in' })
  @ApiProperty({ name: 'expires_in', description: 'Access token TTL in seconds', example: 900 })
  readonly expiresIn!: number;

  @Expose()
  @ApiProperty({ type: UserResponseDto })
  @Type(() => UserResponseDto)
  readonly user!: UserResponseDto;
}
