import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import { TrendPeriod } from '../requests/projects-trend.dto';
import { IProjectTrendResponse } from './interfaces/project-trend.response.interface';
import { ProjectTrendPointResponseDto } from './project-trend-point-response.dto';

@Exclude()
export class ProjectTrendResponseDto implements IProjectTrendResponse {
  @Expose()
  @ApiProperty({ enum: TrendPeriod, example: TrendPeriod.MONTHLY })
  public readonly period!: TrendPeriod;

  @Expose()
  @ApiProperty({ type: [ProjectTrendPointResponseDto] })
  @Type(() => ProjectTrendPointResponseDto)
  public readonly data!: ProjectTrendPointResponseDto[];
}
