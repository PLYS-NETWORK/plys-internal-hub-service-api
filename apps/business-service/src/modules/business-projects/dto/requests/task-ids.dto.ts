import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

const MIN_TASK_IDS = 1;
const MAX_TASK_IDS = 50;

/**
 * Shared body for the bulk-task endpoints (delete, add-to-board, pay-tasks).
 * One DTO so the contract is identical across the three operations.
 */
export class TaskIdsDto {
  @Expose({ name: 'task_ids' })
  @ApiProperty({
    name: 'task_ids',
    type: [String],
    minItems: MIN_TASK_IDS,
    maxItems: MAX_TASK_IDS,
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsArray()
  @ArrayMinSize(MIN_TASK_IDS)
  @ArrayMaxSize(MAX_TASK_IDS)
  @IsUUID('4', { each: true })
  public readonly taskIds!: string[];
}
