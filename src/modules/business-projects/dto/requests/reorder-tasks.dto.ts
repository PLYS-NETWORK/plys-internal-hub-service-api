import { TaskKanbanStatus } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

import { IReorderTasksRequest, ITaskOrderItem } from './interfaces/reorder-tasks.request.interface';

// Service slices the payload into batches of REORDER_BATCH_SIZE before issuing
// the bulk SQL UPDATE. Defined here so DTO docs and the service stay in sync.
export const REORDER_MIN_TASKS = 1;
export const REORDER_MAX_TASKS = 200;

export class TaskOrderItemDto implements ITaskOrderItem {
  @Expose({ name: 'task_id' })
  @ApiProperty({ name: 'task_id' })
  @IsUUID('4')
  public readonly taskId!: string;

  @Expose({ name: 'display_order' })
  @ApiProperty({ name: 'display_order', minimum: 1 })
  @IsInt()
  @Min(1)
  public readonly displayOrder!: number;
}

export class ReorderTasksDto implements IReorderTasksRequest {
  @Expose({ name: 'current_status' })
  @ApiProperty({
    name: 'current_status',
    enum: TaskKanbanStatus,
    description:
      'The column the tasks currently live in. Every task in the payload must already be in this status — otherwise the request is rejected with TASK_INVALID_STATUS_TRANSITION.',
  })
  @IsEnum(TaskKanbanStatus)
  public readonly currentStatus!: TaskKanbanStatus;

  @Expose({ name: 'tasks' })
  @ApiProperty({
    name: 'tasks',
    type: () => TaskOrderItemDto,
    isArray: true,
    minItems: REORDER_MIN_TASKS,
    maxItems: REORDER_MAX_TASKS,
  })
  @IsArray()
  @ArrayMinSize(REORDER_MIN_TASKS)
  @ArrayMaxSize(REORDER_MAX_TASKS)
  @ValidateNested({ each: true })
  @Type(() => TaskOrderItemDto)
  public readonly tasks!: TaskOrderItemDto[];
}
