import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IProjectInterviewStatsResponse } from './interfaces/project-interview-stats.response.interface';

@Exclude()
export class ProjectInterviewStatsResponseDto implements IProjectInterviewStatsResponse {
  @Expose()
  @ApiProperty({ name: 'total_projects', example: 24 })
  public readonly total_projects!: number;

  @Expose()
  @ApiProperty({ name: 'with_questions_count', example: 15 })
  public readonly with_questions_count!: number;

  @Expose()
  @ApiProperty({ name: 'without_questions_count', example: 9 })
  public readonly without_questions_count!: number;

  @Expose()
  @ApiProperty({ name: 'adoption_rate', example: 0.625 })
  public readonly adoption_rate!: number;
}
