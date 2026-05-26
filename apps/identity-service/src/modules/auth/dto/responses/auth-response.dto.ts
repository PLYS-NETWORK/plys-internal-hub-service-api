import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform, Type } from 'class-transformer';

import { IAuthResponse } from './interfaces/auth-response.response.interface';
import { UserResponseDto } from './user-response.dto';

@Exclude()
export class AuthResponseDto implements IAuthResponse {
  @Expose({ name: 'accessToken' })
  @ApiProperty({ name: 'access_token' })
  public readonly access_token!: string;

  @Expose({ name: 'refreshToken' })
  @ApiProperty({ name: 'refresh_token' })
  public readonly refresh_token!: string;

  @Expose({ name: 'expiresIn' })
  @ApiProperty({ name: 'expires_in', description: 'Access token TTL in seconds', example: 900 })
  public readonly expires_in!: number;

  @Expose()
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj['user'])
  @Type(() => UserResponseDto)
  @ApiProperty({ type: UserResponseDto })
  public readonly user!: UserResponseDto;
}
