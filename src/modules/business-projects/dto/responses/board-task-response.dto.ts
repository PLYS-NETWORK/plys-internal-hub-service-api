import { TaskDifficulty, TaskKanbanStatus } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IBoardTaskAssignee,
  IBoardTaskDetailResponse,
  IBoardTaskResponse,
} from './interfaces/board-task.response.interface';

@Exclude()
export class BoardTaskAssigneeDto implements IBoardTaskAssignee {
  @Expose() @ApiProperty({ name: 'consultant_id' }) public readonly consultant_id!: string;
  @Expose() @ApiProperty({ name: 'full_name' }) public readonly full_name!: string;
  @Expose()
  @ApiProperty({ name: 'avatar_url', nullable: true })
  public readonly avatar_url!: string | null;
}

@Exclude()
export class BoardTaskResponseDto implements IBoardTaskResponse {
  @Expose() @ApiProperty() public readonly id!: string;
  @Expose() @ApiProperty() public readonly title!: string;
  @Expose() @ApiProperty({ example: '500.00' }) public readonly price!: string;
  @Expose()
  @ApiProperty({ name: 'difficulty_level', enum: TaskDifficulty })
  public readonly difficulty_level!: TaskDifficulty;
  @Expose()
  @ApiProperty({ name: 'kanban_status', enum: TaskKanbanStatus })
  public readonly kanban_status!: TaskKanbanStatus;
  @Expose()
  @ApiProperty({ name: 'display_order', example: 1 })
  public readonly display_order!: number;

  @Expose()
  @Type(() => BoardTaskAssigneeDto)
  @ApiProperty({ type: () => BoardTaskAssigneeDto, nullable: true })
  public readonly assignee!: BoardTaskAssigneeDto | null;

  @Expose()
  @ApiProperty({ name: 'comments_count', example: 0 })
  public readonly comments_count!: number;
  @Expose()
  @ApiProperty({ name: 'evidences_count', example: 0 })
  public readonly evidences_count!: number;
}

@Exclude()
export class BoardTaskDetailResponseDto
  extends BoardTaskResponseDto
  implements IBoardTaskDetailResponse
{
  @Expose()
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  public readonly description!: Record<string, unknown> | null;

  @Expose()
  @ApiProperty({ name: 'platform_fee_amount', example: '50.00' })
  public readonly platform_fee_amount!: string;
  @Expose()
  @ApiProperty({ name: 'consultant_payout', example: '450.00' })
  public readonly consultant_payout!: string;
  @Expose()
  @ApiProperty({ name: 'approved_by', nullable: true })
  public readonly approved_by!: string | null;
  @Expose()
  @ApiProperty({ name: 'approved_at', nullable: true })
  public readonly approved_at!: Date | null;
  @Expose()
  @ApiProperty({ name: 'due_date', nullable: true })
  public readonly due_date!: Date | null;
  @Expose() @ApiProperty({ example: 1 }) public readonly version!: number;
  @Expose() @ApiProperty({ name: 'created_at' }) public readonly created_at!: Date;
  @Expose() @ApiProperty({ name: 'updated_at' }) public readonly updated_at!: Date;
}
