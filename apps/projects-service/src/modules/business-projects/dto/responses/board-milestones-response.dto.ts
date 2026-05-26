import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IBoardMilestonesResponse } from './interfaces/board-milestones.response.interface';

@Exclude()
export class BoardMilestonesResponseDto implements IBoardMilestonesResponse {
  @Expose()
  @ApiProperty({ example: 12 })
  public readonly total_tasks!: number;

  @Expose()
  @ApiProperty({ example: 3 })
  public readonly total_to_do!: number;

  @Expose()
  @ApiProperty({ example: 2 })
  public readonly total_assigned!: number;

  @Expose()
  @ApiProperty({ example: 1 })
  public readonly total_in_progress!: number;

  @Expose()
  @ApiProperty({ example: 1 })
  public readonly total_in_review!: number;

  @Expose()
  @ApiProperty({ example: 1 })
  public readonly total_pending_approval!: number;

  @Expose()
  @ApiProperty({ example: 0 })
  public readonly total_revision_requested!: number;

  @Expose()
  @ApiProperty({ example: 3 })
  public readonly total_done!: number;

  @Expose()
  @ApiProperty({ example: 1 })
  public readonly total_cancelled!: number;
}
