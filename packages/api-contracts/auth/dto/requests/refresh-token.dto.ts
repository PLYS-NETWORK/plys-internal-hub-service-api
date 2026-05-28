import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { IRefreshTokenRequest } from './interfaces/refresh-token.request.interface';

export class RefreshTokenDto implements IRefreshTokenRequest {
  @Expose()
  @ApiProperty({ name: 'refresh_token' })
  @IsString()
  public readonly refresh_token!: string;
}
