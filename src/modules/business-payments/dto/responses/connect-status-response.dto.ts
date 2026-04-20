import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IConnectStatusResponse } from './interfaces/connect-status.response.interface';

@Exclude()
export class ConnectStatusResponseDto implements IConnectStatusResponse {
  @Expose()
  @ApiProperty({ example: true })
  public readonly is_connected!: boolean;

  @Expose()
  @ApiPropertyOptional({ example: 'acct_1234567890' })
  public readonly account_id!: string | null;

  @Expose()
  @ApiPropertyOptional({ example: 'https://connect.stripe.com/...' })
  public readonly onboarding_url!: string | null;
}
