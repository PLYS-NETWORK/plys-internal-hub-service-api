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

const MIN_TASKS = 1;
const MAX_TASKS = 100;

export class TaskPositionItemDto {
  @Expose({ name: 'task_id' })
  @ApiProperty({ name: 'task_id' })
  @IsUUID('4')
  public readonly taskId!: string;

  @Expose({ name: 'kanban_status' })
  @ApiProperty({ name: 'kanban_status', enum: TaskKanbanStatus })
  @IsEnum(TaskKanbanStatus)
  public readonly kanbanStatus!: TaskKanbanStatus;

  @Expose({ name: 'display_order' })
  @ApiProperty({ name: 'display_order', minimum: 0 })
  @IsInt()
  @Min(0)
  public readonly displayOrder!: number;
}

export class UpdateTaskPositionsDto {
  @Expose({ name: 'tasks' })
  @ApiProperty({ name: 'tasks', type: () => TaskPositionItemDto, isArray: true })
  @IsArray()
  @ArrayMinSize(MIN_TASKS)
  @ArrayMaxSize(MAX_TASKS)
  @ValidateNested({ each: true })
  @Type(() => TaskPositionItemDto)
  public readonly tasks!: TaskPositionItemDto[];
}
