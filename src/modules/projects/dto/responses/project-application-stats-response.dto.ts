import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IProjectApplicationStatsResponse } from './interfaces/project-application-stats.response.interface';

@Exclude()
export class ProjectApplicationStatsResponseDto implements IProjectApplicationStatsResponse {
  @Expose()
  @ApiProperty({ name: 'project_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly project_id!: string;

  @Expose()
  @ApiProperty({ name: 'total_applications', example: 22 })
  public readonly total_applications!: number;

  @Expose()
  @ApiProperty({ name: 'pending_count', example: 5 })
  public readonly pending_count!: number;

  @Expose()
  @ApiProperty({ name: 'accepted_count', example: 10 })
  public readonly accepted_count!: number;

  @Expose()
  @ApiProperty({ name: 'rejected_count', example: 7 })
  public readonly rejected_count!: number;

  @Expose()
  @ApiProperty({ name: 'withdrawn_count', example: 0 })
  public readonly withdrawn_count!: number;
}
