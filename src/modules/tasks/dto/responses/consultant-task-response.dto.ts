import { TaskDifficulty } from '@database/enums/task-difficulty.enum';
import { TaskKanbanStatus } from '@database/enums/task-kanban-status.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IConsultantTaskResponse } from './interfaces/consultant-task.response.interface';

@Exclude()
export class ConsultantTaskResponseDto implements IConsultantTaskResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'project_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly project_id!: string;

  @Expose()
  @ApiProperty({ example: 'Implement authentication module' })
  public readonly title!: string;

  @Expose()
  @ApiProperty({ nullable: true })
  public readonly description!: string | null;

  @Expose()
  @ApiProperty({ name: 'difficulty_level', enum: TaskDifficulty, example: TaskDifficulty.MEDIUM })
  public readonly difficulty_level!: TaskDifficulty;

  @Expose()
  @ApiProperty({ name: 'kanban_status', enum: TaskKanbanStatus, example: TaskKanbanStatus.TO_DO })
  public readonly kanban_status!: TaskKanbanStatus;

  @Expose()
  @ApiProperty({ name: 'assigned_to', nullable: true })
  public readonly assigned_to!: string | null;

  @Expose()
  @ApiProperty({ name: 'assigned_at', nullable: true })
  public readonly assigned_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'display_order', example: 1 })
  public readonly display_order!: number;

  @Expose()
  @ApiProperty({ name: 'created_at' })
  public readonly created_at!: Date;
}
