import { ApplicationStatus } from '@database/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IApplicationStatusResponse } from './application-status.response.interface';

@Exclude()
export class ApplicationStatusResponseDto implements IApplicationStatusResponse {
  @Expose()
  @ApiProperty()
  public readonly id!: string;

  @Expose()
  @ApiProperty({ enum: ApplicationStatus })
  public readonly status!: ApplicationStatus;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  public readonly blocked_until!: string | null;

  @Expose()
  @ApiProperty()
  public readonly created_at!: string;
}
