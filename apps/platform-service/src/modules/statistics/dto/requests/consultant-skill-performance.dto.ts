import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

import {
  ConsultantSkillPerformanceSort,
  IConsultantSkillPerformanceRequest,
} from './interfaces/consultant-skill-performance.request.interface';

const SORT_VALUES: readonly ConsultantSkillPerformanceSort[] = [
  'completed_tasks_desc',
  'earnings_desc',
  'rating_desc',
];

export class ConsultantSkillPerformanceDto implements IConsultantSkillPerformanceRequest {
  @Expose({ name: 'limit' })
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  public readonly limit: number = 20;

  @Expose({ name: 'sort' })
  @ApiPropertyOptional({ enum: SORT_VALUES, default: 'completed_tasks_desc' })
  @IsEnum(SORT_VALUES)
  @IsOptional()
  public readonly sort: ConsultantSkillPerformanceSort = 'completed_tasks_desc';
}
