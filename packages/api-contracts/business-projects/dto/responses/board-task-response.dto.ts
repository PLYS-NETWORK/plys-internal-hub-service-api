import { ApiProperty } from '@nestjs/swagger';
import { TimezoneDate } from '@plys/libraries/common-nest/decorators/timezone-date.decorator';
import { TaskKanbanStatus } from '@plys/libraries/database/enums';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IBoardTaskAssignee,
  IBoardTaskDetailResponse,
  IBoardTaskResponse,
  IBoardTaskWorkedDuration,
} from './interfaces/board-task.response.interface';
import { TaskAttachmentResponseDto } from './task-attachment-response.dto';

@Exclude()
export class BoardTaskAssigneeDto implements IBoardTaskAssignee {
  @Expose() @ApiProperty({ name: 'consultant_id' }) public readonly consultant_id!: string;
  @Expose() @ApiProperty({ name: 'full_name' }) public readonly full_name!: string;
  @Expose()
  @ApiProperty({ name: 'avatar_url', nullable: true })
  public readonly avatar_url!: string | null;
}

@Exclude()
export class BoardTaskWorkedDurationDto implements IBoardTaskWorkedDuration {
  @Expose() @ApiProperty({ required: false, example: 1 }) public readonly days?: number;
  @Expose() @ApiProperty({ example: 3 }) public readonly hours!: number;
  @Expose()
  @ApiProperty({ name: 'total_seconds', example: 97200 })
  public readonly total_seconds!: number;
}

@Exclude()
export class BoardTaskResponseDto implements IBoardTaskResponse {
  @Expose() @ApiProperty() public readonly id!: string;
  @Expose() @ApiProperty({ example: 'WEB-1' }) public readonly code!: string;
  @Expose() @ApiProperty() public readonly title!: string;

  @Expose()
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  public readonly description!: Record<string, unknown> | null;

  @Expose()
  @ApiProperty({ name: 'kanban_status', enum: TaskKanbanStatus })
  public readonly kanban_status!: TaskKanbanStatus;

  @Expose() @ApiProperty({ example: '500.00' }) public readonly price!: string;

  @Expose()
  @Type(() => BoardTaskAssigneeDto)
  @ApiProperty({ type: () => BoardTaskAssigneeDto, nullable: true })
  public readonly assignee!: BoardTaskAssigneeDto | null;

  @Expose()
  @Type(() => BoardTaskWorkedDurationDto)
  @ApiProperty({ name: 'total_time_worked', type: () => BoardTaskWorkedDurationDto })
  public readonly total_time_worked!: BoardTaskWorkedDurationDto;

  @Expose()
  @ApiProperty({ name: 'attachments_count', example: 0 })
  public readonly attachments_count!: number;

  @Expose()
  @TimezoneDate('YYYY-MM-DD HH:mm')
  @ApiProperty({ name: 'last_update', example: '2026-05-06 14:30' })
  public readonly last_update!: string;

  @Expose()
  @TimezoneDate('YYYY-MM-DD')
  @ApiProperty({ name: 'created_day', example: '2026-05-06' })
  public readonly created_day!: string;
}

@Exclude()
export class BoardTaskDetailResponseDto
  extends BoardTaskResponseDto
  implements IBoardTaskDetailResponse
{
  @Expose()
  @ApiProperty({ name: 'approved_by', nullable: true })
  public readonly approved_by!: string | null;

  @Expose()
  @TimezoneDate()
  @ApiProperty({ name: 'approved_at', nullable: true })
  public readonly approved_at!: string | null;

  @Expose()
  @TimezoneDate()
  @ApiProperty({ name: 'started_at', nullable: true })
  public readonly started_at!: string | null;

  @Expose()
  @TimezoneDate()
  @ApiProperty({ name: 'completed_at', nullable: true })
  public readonly completed_at!: string | null;

  @Expose()
  @Type(() => TaskAttachmentResponseDto)
  @ApiProperty({ type: () => TaskAttachmentResponseDto, isArray: true })
  public readonly attachments!: TaskAttachmentResponseDto[];
}
