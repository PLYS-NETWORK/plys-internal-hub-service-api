import { TaskDifficulty } from '@database/enums/task-difficulty.enum';
import { TaskKanbanStatus } from '@database/enums/task-kanban-status.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { ITaskResponse } from './interfaces/task.response.interface';

@Exclude()
export class TaskResponseDto implements ITaskResponse {
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
  @ApiProperty({ example: 250.0 })
  public readonly price!: number;

  @Expose()
  @ApiProperty({ name: 'platform_fee_amount', example: 25.0 })
  public readonly platform_fee_amount!: number;

  @Expose()
  @ApiProperty({ name: 'consultant_payout', example: 225.0 })
  public readonly consultant_payout!: number;

  @Expose()
  @ApiProperty({ name: 'difficulty_level', enum: TaskDifficulty, example: TaskDifficulty.MEDIUM })
  public readonly difficulty_level!: TaskDifficulty;

  @Expose()
  @ApiProperty({ name: 'kanban_status', enum: TaskKanbanStatus, example: TaskKanbanStatus.DRAFT })
  public readonly kanban_status!: TaskKanbanStatus;

  @Expose()
  @ApiProperty({ name: 'assigned_to', nullable: true })
  public readonly assigned_to!: string | null;

  @Expose()
  @ApiProperty({ name: 'assigned_at', nullable: true })
  public readonly assigned_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'approved_by', nullable: true })
  public readonly approved_by!: string | null;

  @Expose()
  @ApiProperty({ name: 'approved_at', nullable: true })
  public readonly approved_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'display_order', example: 1 })
  public readonly display_order!: number;

  @Expose()
  @ApiProperty({ name: 'created_at' })
  public readonly created_at!: Date;
}
