import { TaskKanbanStatus } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IProjectTaskStatsResponse } from './interfaces/project-task-stats.response.interface';

@Exclude()
export class ProjectTaskStatsResponseDto implements IProjectTaskStatsResponse {
  @Expose()
  @ApiProperty({ name: 'project_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly project_id!: string;

  @Expose()
  @ApiProperty({ name: 'total_open', example: 38 })
  public readonly total_open!: number;

  @Expose()
  @ApiProperty({
    name: 'by_status',
    description: 'Counts keyed by every value of TaskKanbanStatus.',
    example: {
      draft: 1,
      to_do: 12,
      assigned: 4,
      in_progress: 9,
      in_review: 5,
      pending_approval: 2,
      revision_requested: 1,
      done: 4,
      cancelled: 0,
    },
  })
  public readonly by_status!: Record<TaskKanbanStatus, number>;
}
