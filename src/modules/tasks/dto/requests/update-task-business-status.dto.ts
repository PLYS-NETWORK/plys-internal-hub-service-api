import { TaskKanbanStatus } from '@database/enums/task-kanban-status.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEnum, IsNotEmpty } from 'class-validator';

import { IUpdateTaskBusinessStatusRequest } from './interfaces/update-task-business-status.request.interface';

export class UpdateTaskBusinessStatusDto implements IUpdateTaskBusinessStatusRequest {
  @Expose()
  @ApiProperty({ enum: TaskKanbanStatus, example: TaskKanbanStatus.TO_DO })
  @IsEnum(TaskKanbanStatus)
  @IsNotEmpty()
  public readonly status!: TaskKanbanStatus;
}
