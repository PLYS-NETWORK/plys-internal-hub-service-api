import { TaskKanbanStatus } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEnum } from 'class-validator';

import { IChangeTaskStatusRequest } from './interfaces/change-task-status.request.interface';

export class ChangeTaskStatusDto implements IChangeTaskStatusRequest {
  @Expose({ name: 'kanban_status' })
  @ApiProperty({
    name: 'kanban_status',
    enum: TaskKanbanStatus,
    description:
      'Target kanban status. Allowed transitions: ASSIGNED→IN_PROGRESS, IN_PROGRESS→IN_REVIEW, IN_REVIEW→IN_PROGRESS.',
  })
  @IsEnum(TaskKanbanStatus)
  public readonly kanbanStatus!: TaskKanbanStatus;
}
