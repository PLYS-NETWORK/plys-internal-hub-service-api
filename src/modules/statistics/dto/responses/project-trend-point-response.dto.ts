import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IProjectTrendPointResponse } from './interfaces/project-trend-point.response.interface';

@Exclude()
export class ProjectTrendPointResponseDto implements IProjectTrendPointResponse {
  @Expose()
  @ApiProperty({ name: 'period_label', example: '2026-01' })
  public readonly period_label!: string;

  @Expose()
  @ApiProperty({ name: 'created_count', example: 4 })
  public readonly created_count!: number;

  @Expose()
  @ApiProperty({ name: 'published_count', example: 3 })
  public readonly published_count!: number;
}
