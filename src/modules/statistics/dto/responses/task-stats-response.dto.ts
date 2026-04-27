import { TaskKanbanStatus } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { ITaskStatsResponse } from './interfaces/task-stats.response.interface';

@Exclude()
export class TaskStatsResponseDto implements ITaskStatsResponse {
  @Expose()
  @ApiProperty({ name: 'total_open', example: 138 })
  public readonly total_open!: number;

  @Expose()
  @ApiProperty({
    name: 'by_status',
    description: 'Counts keyed by every value of TaskKanbanStatus.',
    example: {
      draft: 5,
      to_do: 58,
      assigned: 12,
      in_progress: 35,
      in_review: 18,
      pending_approval: 4,
      revision_requested: 6,
      done: 27,
      cancelled: 0,
    },
  })
  public readonly by_status!: Record<TaskKanbanStatus, number>;
}
