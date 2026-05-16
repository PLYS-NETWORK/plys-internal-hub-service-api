import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IBusinessTeamPerformanceItem,
  IBusinessTeamPerformanceResponse,
} from './interfaces/business-team-performance.response.interface';

@Exclude()
export class BusinessTeamPerformanceItemDto implements IBusinessTeamPerformanceItem {
  @Expose()
  @ApiProperty({ name: 'consultant_id' })
  public readonly consultant_id!: string;
  @Expose()
  @ApiProperty({ name: 'full_name', example: 'Jane Doe' })
  public readonly full_name!: string;
  @Expose()
  @ApiPropertyOptional({ name: 'avatar_url', nullable: true })
  public readonly avatar_url!: string | null;
  @Expose()
  @ApiProperty({ name: 'active_projects_count', example: 2 })
  public readonly active_projects_count!: number;
  @Expose()
  @ApiProperty({ name: 'completed_tasks', example: 11 })
  public readonly completed_tasks!: number;
  @Expose()
  @ApiProperty({ name: 'in_progress_tasks', example: 2 })
  public readonly in_progress_tasks!: number;
  @Expose()
  @ApiPropertyOptional({ name: 'avg_cycle_days', example: '1.8', nullable: true })
  public readonly avg_cycle_days!: string | null;
  @Expose()
  @ApiPropertyOptional({ name: 'on_time_pct', example: '90.9', nullable: true })
  public readonly on_time_pct!: string | null;
}

@Exclude()
export class BusinessTeamPerformanceResponseDto implements IBusinessTeamPerformanceResponse {
  @Expose()
  @Type(() => BusinessTeamPerformanceItemDto)
  @ApiProperty({ type: BusinessTeamPerformanceItemDto, isArray: true })
  public readonly consultants!: BusinessTeamPerformanceItemDto[];

  @Expose()
  @ApiProperty({ name: 'generated_at', example: '2026-05-16T10:12:30.123Z' })
  public readonly generated_at!: string;
}
