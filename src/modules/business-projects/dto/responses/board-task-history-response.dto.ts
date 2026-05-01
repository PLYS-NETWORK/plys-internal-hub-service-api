import { TaskHistoryChangeType, TaskKanbanStatus } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IBoardHistoryAssignee,
  IBoardHistoryAuthor,
  IBoardTaskHistoryResponse,
} from './interfaces/board-task-history.response.interface';

@Exclude()
export class BoardHistoryAssigneeDto implements IBoardHistoryAssignee {
  @Expose() @ApiProperty({ name: 'consultant_id' }) public readonly consultant_id!: string;
  @Expose() @ApiProperty({ name: 'full_name' }) public readonly full_name!: string;
  @Expose()
  @ApiProperty({ name: 'avatar_url', nullable: true })
  public readonly avatar_url!: string | null;
}

@Exclude()
export class BoardHistoryAuthorDto implements IBoardHistoryAuthor {
  @Expose()
  @ApiProperty({ name: 'user_id', nullable: true })
  public readonly user_id!: string | null;

  @Expose() @ApiProperty() public readonly name!: string;

  @Expose()
  @ApiProperty({ name: 'avatar_url', nullable: true })
  public readonly avatar_url!: string | null;
}

@Exclude()
export class BoardTaskHistoryResponseDto implements IBoardTaskHistoryResponse {
  @Expose() @ApiProperty() public readonly id!: string;
  @Expose() @ApiProperty({ name: 'task_id' }) public readonly task_id!: string;

  @Expose()
  @ApiProperty({ name: 'change_type', enum: TaskHistoryChangeType })
  public readonly change_type!: TaskHistoryChangeType;

  @Expose()
  @ApiProperty({ name: 'previous_kanban_status', enum: TaskKanbanStatus, nullable: true })
  public readonly previous_kanban_status!: TaskKanbanStatus | null;

  @Expose()
  @ApiProperty({ name: 'new_kanban_status', enum: TaskKanbanStatus, nullable: true })
  public readonly new_kanban_status!: TaskKanbanStatus | null;

  @Expose()
  @Type(() => BoardHistoryAssigneeDto)
  @ApiProperty({ name: 'previous_assignee', type: () => BoardHistoryAssigneeDto, nullable: true })
  public readonly previous_assignee!: BoardHistoryAssigneeDto | null;

  @Expose()
  @Type(() => BoardHistoryAssigneeDto)
  @ApiProperty({ name: 'new_assignee', type: () => BoardHistoryAssigneeDto, nullable: true })
  public readonly new_assignee!: BoardHistoryAssigneeDto | null;

  @Expose()
  @Type(() => BoardHistoryAuthorDto)
  @ApiProperty({ type: () => BoardHistoryAuthorDto })
  public readonly author!: BoardHistoryAuthorDto;

  @Expose()
  @ApiProperty({ nullable: true })
  public readonly note!: string | null;

  @Expose() @ApiProperty({ name: 'changed_at' }) public readonly changed_at!: Date;
}
