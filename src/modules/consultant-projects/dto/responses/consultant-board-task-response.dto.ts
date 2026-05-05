import { TaskDifficulty, TaskKanbanStatus } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IConsultantBoardTaskAssignee,
  IConsultantBoardTaskResponse,
} from './interfaces/consultant-board-task.response.interface';

@Exclude()
export class ConsultantBoardTaskAssigneeDto implements IConsultantBoardTaskAssignee {
  @Expose() @ApiProperty({ name: 'consultant_id' }) public readonly consultant_id!: string;
  @Expose() @ApiProperty({ name: 'full_name' }) public readonly full_name!: string;
  @Expose()
  @ApiProperty({ name: 'avatar_url', nullable: true })
  public readonly avatar_url!: string | null;
}

@Exclude()
export class ConsultantBoardTaskResponseDto implements IConsultantBoardTaskResponse {
  @Expose() @ApiProperty() public readonly id!: string;
  @Expose() @ApiProperty() public readonly code!: string;
  @Expose() @ApiProperty() public readonly title!: string;

  @Expose()
  @ApiProperty({ name: 'kanban_status', enum: TaskKanbanStatus })
  public readonly kanban_status!: TaskKanbanStatus;

  @Expose() @ApiProperty({ name: 'display_order' }) public readonly display_order!: number;

  @Expose()
  @ApiProperty({ name: 'difficulty_level', enum: TaskDifficulty })
  public readonly difficulty_level!: TaskDifficulty;

  @Expose()
  @Type(() => ConsultantBoardTaskAssigneeDto)
  @ApiProperty({ type: () => ConsultantBoardTaskAssigneeDto, nullable: true })
  public readonly assignee!: ConsultantBoardTaskAssigneeDto | null;

  @Expose() @ApiProperty({ name: 'evidences_count' }) public readonly evidences_count!: number;
}
