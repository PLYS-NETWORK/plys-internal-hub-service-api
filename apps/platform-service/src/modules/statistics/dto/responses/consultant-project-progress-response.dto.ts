import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectPaymentType, ProjectStatus } from '@plys/libraries/database/enums';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IConsultantProjectProgressItem,
  IConsultantProjectProgressResponse,
} from './interfaces/consultant-project-progress.response.interface';

@Exclude()
export class ConsultantProjectProgressItemDto implements IConsultantProjectProgressItem {
  @Expose()
  @ApiProperty({ name: 'project_id' })
  public readonly project_id!: string;
  @Expose()
  @ApiProperty({ example: 'WEB' })
  public readonly code!: string;
  @Expose()
  @ApiProperty({ example: 'Marketing Site Revamp' })
  public readonly title!: string;
  @Expose()
  @ApiProperty({ enum: ProjectStatus })
  public readonly status!: ProjectStatus;
  @Expose()
  @ApiProperty({ name: 'payment_type', enum: ProjectPaymentType })
  public readonly payment_type!: ProjectPaymentType;
  @Expose()
  @ApiProperty({ name: 'joined_at', example: '2026-04-01T00:00:00.000Z' })
  public readonly joined_at!: string;
  @Expose()
  @ApiProperty({ name: 'my_assigned_tasks', example: 3 })
  public readonly my_assigned_tasks!: number;
  @Expose()
  @ApiProperty({ name: 'my_in_progress_tasks', example: 1 })
  public readonly my_in_progress_tasks!: number;
  @Expose()
  @ApiProperty({ name: 'my_in_review_tasks', example: 1 })
  public readonly my_in_review_tasks!: number;
  @Expose()
  @ApiProperty({ name: 'my_completed_tasks', example: 5 })
  public readonly my_completed_tasks!: number;
  @Expose()
  @ApiProperty({ name: 'my_overdue_tasks', example: 0 })
  public readonly my_overdue_tasks!: number;
  @Expose()
  @ApiProperty({ name: 'my_revision_requested_tasks', example: 0 })
  public readonly my_revision_requested_tasks!: number;
  @Expose()
  @ApiPropertyOptional({ name: 'my_completion_pct', example: '62.5', nullable: true })
  public readonly my_completion_pct!: string | null;
  @Expose()
  @ApiProperty({ name: 'my_earnings_in_project', example: '2400.00' })
  public readonly my_earnings_in_project!: string;
  @Expose()
  @ApiPropertyOptional({
    name: 'last_activity_at',
    nullable: true,
    example: '2026-05-15T08:00:00.000Z',
  })
  public readonly last_activity_at!: string | null;
  @Expose()
  @ApiProperty({ name: 'is_at_risk', example: false })
  public readonly is_at_risk!: boolean;
}

@Exclude()
export class ConsultantProjectProgressResponseDto implements IConsultantProjectProgressResponse {
  @Expose()
  @Type(() => ConsultantProjectProgressItemDto)
  @ApiProperty({ type: ConsultantProjectProgressItemDto, isArray: true })
  public readonly projects!: ConsultantProjectProgressItemDto[];

  @Expose()
  @ApiProperty({ name: 'generated_at', example: '2026-05-16T10:12:30.123Z' })
  public readonly generated_at!: string;
}
