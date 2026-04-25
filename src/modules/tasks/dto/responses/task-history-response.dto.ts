import { TaskHistoryChangeType, TaskKanbanStatus } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { ITaskHistoryResponse } from './interfaces/task-history.response.interface';

@Exclude()
export class TaskHistoryResponseDto implements ITaskHistoryResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'task_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly task_id!: string;

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
  @ApiProperty({ name: 'previous_assigned_to', nullable: true })
  public readonly previous_assigned_to!: string | null;

  @Expose()
  @ApiProperty({ name: 'new_assigned_to', nullable: true })
  public readonly new_assigned_to!: string | null;

  @Expose()
  @ApiProperty({ name: 'changed_by', nullable: true })
  public readonly changed_by!: string | null;

  @Expose()
  @ApiProperty({ nullable: true })
  public readonly note!: string | null;

  @Expose()
  @ApiProperty({ name: 'changed_at' })
  public readonly changed_at!: Date;
}
