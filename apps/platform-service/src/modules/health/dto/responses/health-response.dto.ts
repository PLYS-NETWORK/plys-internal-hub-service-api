import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { HealthStatus, IHealthResponse } from './health-response.response.interface';

@Exclude()
export class HealthResponseDto implements IHealthResponse {
  @Expose()
  @ApiProperty({ example: 'ok', enum: ['ok', 'error'] })
  public readonly status!: HealthStatus;

  @Expose()
  @ApiProperty({ example: 'ok', enum: ['ok', 'error'] })
  public readonly database!: HealthStatus;

  @Expose()
  @ApiProperty({ example: 'ok', enum: ['ok', 'error'] })
  public readonly redis!: HealthStatus;
}
