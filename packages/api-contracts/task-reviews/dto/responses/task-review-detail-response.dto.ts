import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { ITaskReviewDetailResponse } from './interfaces/task-review.response.interface';

@Exclude()
export class TaskReviewDetailResponseDto implements ITaskReviewDetailResponse {
  @Expose()
  @ApiProperty()
  public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'task_id' })
  public readonly task_id!: string;

  @Expose()
  @ApiProperty({ name: 'task_code' })
  public readonly task_code!: string;

  @Expose()
  @ApiProperty({ name: 'task_title' })
  public readonly task_title!: string;

  @Expose()
  @ApiProperty({ name: 'project_id' })
  public readonly project_id!: string;

  @Expose()
  @ApiProperty({ name: 'round_number' })
  public readonly round_number!: number;

  @Expose()
  @ApiProperty({ name: 'is_arbiter' })
  public readonly is_arbiter!: boolean;

  @Expose()
  @ApiProperty()
  public readonly decision!: string;

  @Expose()
  @ApiProperty({ name: 'assigned_at' })
  public readonly assigned_at!: Date;

  @Expose()
  @ApiProperty({ name: 'voted_at', nullable: true })
  public readonly voted_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'task_description', nullable: true })
  public readonly task_description!: Record<string, unknown> | null;

  @Expose()
  @ApiProperty({ name: 'task_price', example: '100.00' })
  public readonly task_price!: string;

  @Expose()
  @ApiProperty({ name: 'task_consultant_payout', example: '90.00' })
  public readonly task_consultant_payout!: string;

  @Expose()
  @ApiProperty({ name: 'task_assignee_id', nullable: true })
  public readonly task_assignee_id!: string | null;
}
