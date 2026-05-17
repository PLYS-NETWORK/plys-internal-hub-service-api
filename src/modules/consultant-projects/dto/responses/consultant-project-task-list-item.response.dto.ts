import { TaskKanbanStatus } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IConsultantProjectTaskListItemResponse } from './interfaces/consultant-project-task-list-item.response.interface';

@Exclude()
export class ConsultantProjectTaskListItemResponseDto implements IConsultantProjectTaskListItemResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ example: 'AI-1' })
  public readonly code!: string;

  @Expose()
  @ApiProperty({ example: 'Implement webhook handler' })
  public readonly title!: string;

  @Expose()
  @ApiProperty({ name: 'kanban_status', enum: TaskKanbanStatus, example: TaskKanbanStatus.TO_DO })
  public readonly kanban_status!: TaskKanbanStatus;

  @Expose()
  @ApiProperty({ example: 120.0 })
  public readonly price!: number;

  @Expose()
  @ApiProperty({ name: 'due_date', nullable: true, example: '2026-06-01T00:00:00.000Z' })
  public readonly due_date!: Date | null;

  @Expose()
  @ApiProperty({ name: 'started_at', nullable: true, example: null })
  public readonly started_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'completed_at', nullable: true, example: null })
  public readonly completed_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'assigned_at', nullable: true, example: null })
  public readonly assigned_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'is_mine', example: false })
  public readonly is_mine!: boolean;
}
