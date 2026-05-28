import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectPaymentType, ProjectStatus } from '@plys/libraries/database/enums';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IBusinessProjectHealthItem,
  IBusinessProjectHealthResponse,
} from './interfaces/business-project-health.response.interface';

@Exclude()
export class BusinessProjectHealthItemDto implements IBusinessProjectHealthItem {
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
  @ApiProperty({ name: 'total_tasks', example: 18 })
  public readonly total_tasks!: number;
  @Expose()
  @ApiProperty({ name: 'completed_tasks', example: 7 })
  public readonly completed_tasks!: number;
  @Expose()
  @ApiProperty({ name: 'in_review_tasks', example: 2 })
  public readonly in_review_tasks!: number;
  @Expose()
  @ApiProperty({ name: 'overdue_tasks', example: 1 })
  public readonly overdue_tasks!: number;
  @Expose()
  @ApiPropertyOptional({ name: 'completion_pct', example: '38.9', nullable: true })
  public readonly completion_pct!: string | null;
  @Expose()
  @ApiProperty({ name: 'mtd_spend', example: '1840.00' })
  public readonly mtd_spend!: string;
  @Expose()
  @ApiPropertyOptional({
    name: 'last_activity_at',
    example: '2026-05-15T08:00:00.000Z',
    nullable: true,
  })
  public readonly last_activity_at!: string | null;
  @Expose()
  @ApiProperty({ name: 'is_at_risk', example: true })
  public readonly is_at_risk!: boolean;
}

@Exclude()
export class BusinessProjectHealthResponseDto implements IBusinessProjectHealthResponse {
  @Expose()
  @Type(() => BusinessProjectHealthItemDto)
  @ApiProperty({ type: BusinessProjectHealthItemDto, isArray: true })
  public readonly projects!: BusinessProjectHealthItemDto[];

  @Expose()
  @ApiProperty({ name: 'generated_at', example: '2026-05-16T10:12:30.123Z' })
  public readonly generated_at!: string;
}
