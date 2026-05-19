import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { ITaskReviewResponse } from './interfaces/task-review.response.interface';

@Exclude()
export class TaskReviewResponseDto implements ITaskReviewResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'task_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly task_id!: string;

  @Expose()
  @ApiProperty({ name: 'task_code', example: 'WEB-12' })
  public readonly task_code!: string;

  @Expose()
  @ApiProperty({ name: 'task_title', example: 'Implement product detail page' })
  public readonly task_title!: string;

  @Expose()
  @ApiProperty({ name: 'project_id' })
  public readonly project_id!: string;

  @Expose()
  @ApiProperty({ name: 'round_number', example: 1 })
  public readonly round_number!: number;

  @Expose()
  @ApiProperty({ name: 'is_arbiter', example: false })
  public readonly is_arbiter!: boolean;

  @Expose()
  @ApiProperty({ example: 'pending', enum: ['pending', 'pass', 'fail', 'recused', 'voided'] })
  public readonly decision!: string;

  @Expose()
  @ApiProperty({ name: 'assigned_at' })
  public readonly assigned_at!: Date;

  @Expose()
  @ApiProperty({ name: 'voted_at', nullable: true })
  public readonly voted_at!: Date | null;
}
