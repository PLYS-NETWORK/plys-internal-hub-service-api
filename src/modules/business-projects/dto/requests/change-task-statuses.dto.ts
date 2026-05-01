import { TaskKanbanStatus } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsUUID,
  ValidateNested,
} from 'class-validator';

import {
  IChangeTaskStatusesRequest,
  ITaskStatusItem,
} from './interfaces/change-task-statuses.request.interface';

export const STATUS_MIN_TASKS = 1;
export const STATUS_MAX_TASKS = 200;

export class TaskStatusItemDto implements ITaskStatusItem {
  @Expose({ name: 'task_id' })
  @ApiProperty({ name: 'task_id' })
  @IsUUID('4')
  public readonly taskId!: string;

  @Expose({ name: 'kanban_status' })
  @ApiProperty({
    name: 'kanban_status',
    enum: TaskKanbanStatus,
    description: 'Target column. DRAFT/DONE/CANCELLED are owned by other flows and rejected here.',
  })
  @IsEnum(TaskKanbanStatus)
  public readonly kanbanStatus!: TaskKanbanStatus;
}

export class ChangeTaskStatusesDto implements IChangeTaskStatusesRequest {
  @Expose({ name: 'tasks' })
  @ApiProperty({
    name: 'tasks',
    type: () => TaskStatusItemDto,
    isArray: true,
    minItems: STATUS_MIN_TASKS,
    maxItems: STATUS_MAX_TASKS,
    description:
      'Tasks to move. Each task lands at the END of its destination column in payload order.',
  })
  @IsArray()
  @ArrayMinSize(STATUS_MIN_TASKS)
  @ArrayMaxSize(STATUS_MAX_TASKS)
  @ValidateNested({ each: true })
  @Type(() => TaskStatusItemDto)
  public readonly tasks!: TaskStatusItemDto[];
}
