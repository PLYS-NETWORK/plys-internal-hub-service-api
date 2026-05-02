import { ProjectPaymentType, ProjectStatus, TaskKanbanStatus } from '@database/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IConsultantOverviewByStatus,
  IConsultantOverviewCompletedTask,
  IConsultantOverviewConsultant,
  IConsultantOverviewEarnings,
  IConsultantOverviewNextPayment,
  IConsultantOverviewPaymentHistoryItem,
  IConsultantOverviewProgress,
  IConsultantOverviewProject,
  IConsultantOverviewResponse,
} from './interfaces/consultant-overview.response.interface';

@Exclude()
export class ConsultantOverviewProjectDto implements IConsultantOverviewProject {
  @Expose() @ApiProperty() public readonly id!: string;
  @Expose() @ApiProperty() public readonly title!: string;

  @Expose()
  @ApiProperty({ name: 'payment_type', enum: ProjectPaymentType })
  public readonly payment_type!: ProjectPaymentType;

  @Expose()
  @ApiProperty({ enum: ProjectStatus })
  public readonly status!: ProjectStatus;

  @Expose()
  @ApiProperty({ name: 'started_at', nullable: true })
  public readonly started_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'days_remaining', nullable: true })
  public readonly days_remaining!: null;
}

@Exclude()
export class ConsultantOverviewConsultantDto implements IConsultantOverviewConsultant {
  @Expose() @ApiProperty() public readonly id!: string;
  @Expose() @ApiProperty({ name: 'full_name' }) public readonly full_name!: string;

  @Expose()
  @ApiProperty({ name: 'avatar_url', nullable: true })
  public readonly avatar_url!: string | null;

  @Expose() @ApiProperty({ name: 'joined_at' }) public readonly joined_at!: Date;
}

@Exclude()
export class ConsultantOverviewProgressDto implements IConsultantOverviewProgress {
  @Expose()
  @ApiProperty({
    name: 'by_status',
    description: 'Map of kanban_status -> count for tasks assigned to this consultant.',
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { todo: 2, in_progress: 1, in_review: 1, done: 8 },
  })
  public readonly by_status!: IConsultantOverviewByStatus;

  @Expose() @ApiProperty({ name: 'total_assigned' }) public readonly total_assigned!: number;

  @Expose()
  @ApiProperty({ name: 'completion_rate', example: 0.67 })
  public readonly completion_rate!: number;
}

@Exclude()
export class ConsultantOverviewCompletedTaskDto implements IConsultantOverviewCompletedTask {
  @Expose() @ApiProperty() public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'task_id', nullable: true })
  public readonly task_id!: string | null;

  @Expose()
  @ApiProperty({ name: 'task_code', nullable: true })
  public readonly task_code!: string | null;

  @Expose()
  @ApiProperty({ name: 'task_name', nullable: true })
  public readonly task_name!: string | null;

  @Expose() @ApiProperty() public readonly amount!: number;
}

@Exclude()
export class ConsultantOverviewPaymentHistoryItemDto implements IConsultantOverviewPaymentHistoryItem {
  @Expose() @ApiProperty() public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'transaction_number' })
  public readonly transaction_number!: string;

  @Expose() @ApiProperty() public readonly amount!: number;
  @Expose() @ApiProperty() public readonly status!: string;
  @Expose() @ApiProperty({ name: 'paid_at' }) public readonly paid_at!: Date;

  @Expose()
  @ApiProperty({ name: 'period_start', nullable: true })
  public readonly period_start!: string | null;

  @Expose()
  @ApiProperty({ name: 'period_end', nullable: true })
  public readonly period_end!: string | null;
}

@Exclude()
export class ConsultantOverviewEarningsDto implements IConsultantOverviewEarnings {
  @Expose() @ApiProperty({ name: 'total_earned' }) public readonly total_earned!: number;
  @Expose() @ApiProperty() public readonly currency!: string;

  @Expose()
  @ApiPropertyOptional({ name: 'pending_amount' })
  public readonly pending_amount?: number;

  @Expose()
  @Type(() => ConsultantOverviewCompletedTaskDto)
  @ApiPropertyOptional({
    name: 'completed_tasks',
    type: () => ConsultantOverviewCompletedTaskDto,
    isArray: true,
  })
  public readonly completed_tasks?: ConsultantOverviewCompletedTaskDto[];

  @Expose()
  @Type(() => ConsultantOverviewPaymentHistoryItemDto)
  @ApiPropertyOptional({
    name: 'payment_history',
    type: () => ConsultantOverviewPaymentHistoryItemDto,
    isArray: true,
  })
  public readonly payment_history?: ConsultantOverviewPaymentHistoryItemDto[];
}

@Exclude()
export class ConsultantOverviewNextPaymentDto implements IConsultantOverviewNextPayment {
  @Expose() @ApiProperty() public readonly date!: Date;
  @Expose() @ApiProperty({ name: 'days_until' }) public readonly days_until!: number;
  @Expose() @ApiProperty() public readonly amount!: number;
  @Expose() @ApiProperty() public readonly currency!: string;

  @Expose()
  @ApiProperty({ name: 'last_paid_at', nullable: true })
  public readonly last_paid_at!: Date | null;
}

@Exclude()
export class ConsultantOverviewResponseDto implements IConsultantOverviewResponse {
  @Expose()
  @Type(() => ConsultantOverviewProjectDto)
  @ApiProperty({ type: () => ConsultantOverviewProjectDto })
  public readonly project!: ConsultantOverviewProjectDto;

  @Expose()
  @Type(() => ConsultantOverviewConsultantDto)
  @ApiProperty({ type: () => ConsultantOverviewConsultantDto })
  public readonly consultant!: ConsultantOverviewConsultantDto;

  @Expose()
  @Type(() => ConsultantOverviewProgressDto)
  @ApiProperty({ type: () => ConsultantOverviewProgressDto })
  public readonly progress!: ConsultantOverviewProgressDto;

  @Expose()
  @Type(() => ConsultantOverviewEarningsDto)
  @ApiProperty({ type: () => ConsultantOverviewEarningsDto })
  public readonly earnings!: ConsultantOverviewEarningsDto;

  @Expose()
  @Type(() => ConsultantOverviewNextPaymentDto)
  @ApiPropertyOptional({ name: 'next_payment', type: () => ConsultantOverviewNextPaymentDto })
  public readonly next_payment?: ConsultantOverviewNextPaymentDto;

  // Re-export so the kanban_status union is represented in the OpenAPI schema.
  public static readonly KANBAN_STATUS_ENUM = TaskKanbanStatus;
}
