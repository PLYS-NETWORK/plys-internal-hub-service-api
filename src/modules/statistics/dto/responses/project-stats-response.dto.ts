import { ProjectStatus } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IProjectStatsResponse } from './interfaces/project-stats.response.interface';

@Exclude()
export class ProjectStatsResponseDto implements IProjectStatsResponse {
  @Expose()
  @ApiProperty({ example: 24 })
  public readonly total!: number;

  @Expose()
  @ApiProperty({
    name: 'by_status',
    description: 'Counts keyed by every value of ProjectStatus.',
    example: {
      draft: 8,
      configured: 1,
      published: 12,
      in_progress: 0,
      done: 3,
      cancelled: 0,
    },
  })
  public readonly by_status!: Record<ProjectStatus, number>;

  @Expose()
  @ApiProperty({ name: 'published_ratio', example: 0.625 })
  public readonly published_ratio!: number;
}
