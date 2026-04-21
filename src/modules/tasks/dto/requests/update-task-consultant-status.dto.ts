import { TaskKanbanStatus } from '@database/enums/task-kanban-status.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEnum, IsNotEmpty } from 'class-validator';

import { IUpdateTaskConsultantStatusRequest } from './interfaces/update-task-consultant-status.request.interface';

export class UpdateTaskConsultantStatusDto implements IUpdateTaskConsultantStatusRequest {
  @Expose()
  @ApiProperty({ enum: TaskKanbanStatus, example: TaskKanbanStatus.IN_PROGRESS })
  @IsEnum(TaskKanbanStatus)
  @IsNotEmpty()
  public readonly status!: TaskKanbanStatus;
}
