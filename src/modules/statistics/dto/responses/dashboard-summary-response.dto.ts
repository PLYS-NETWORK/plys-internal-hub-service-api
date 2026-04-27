import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IDashboardSummaryApplications,
  IDashboardSummaryBilling,
  IDashboardSummaryProjects,
  IDashboardSummaryResponse,
  IDashboardSummaryTasks,
} from './interfaces/dashboard-summary.response.interface';

@Exclude()
export class DashboardSummaryProjectsDto implements IDashboardSummaryProjects {
  @Expose()
  @ApiProperty({ example: 24 })
  public readonly total!: number;

  @Expose()
  @ApiProperty({ example: 12 })
  public readonly published!: number;

  @Expose()
  @ApiProperty({ example: 8 })
  public readonly draft!: number;
}

@Exclude()
export class DashboardSummaryTasksDto implements IDashboardSummaryTasks {
  @Expose()
  @ApiProperty({ name: 'total_open', example: 138 })
  public readonly total_open!: number;

  @Expose()
  @ApiProperty({ name: 'overdue_count', example: 32 })
  public readonly overdue_count!: number;
}

@Exclude()
export class DashboardSummaryApplicationsDto implements IDashboardSummaryApplications {
  @Expose()
  @ApiProperty({ name: 'pending_count', example: 17 })
  public readonly pending_count!: number;
}

@Exclude()
export class DashboardSummaryBillingDto implements IDashboardSummaryBilling {
  @Expose()
  @ApiProperty({ name: 'total_spend', example: '840.00' })
  public readonly total_spend!: string;

  @Expose()
  @ApiProperty({ example: 'USD' })
  public readonly currency!: string;
}

@Exclude()
export class DashboardSummaryResponseDto implements IDashboardSummaryResponse {
  @Expose()
  @ApiProperty({ type: DashboardSummaryProjectsDto })
  @Type(() => DashboardSummaryProjectsDto)
  public readonly projects!: DashboardSummaryProjectsDto;

  @Expose()
  @ApiProperty({ type: DashboardSummaryTasksDto })
  @Type(() => DashboardSummaryTasksDto)
  public readonly tasks!: DashboardSummaryTasksDto;

  @Expose()
  @ApiProperty({ type: DashboardSummaryApplicationsDto })
  @Type(() => DashboardSummaryApplicationsDto)
  public readonly applications!: DashboardSummaryApplicationsDto;

  @Expose()
  @ApiProperty({ type: DashboardSummaryBillingDto })
  @Type(() => DashboardSummaryBillingDto)
  public readonly billing!: DashboardSummaryBillingDto;

  @Expose()
  @ApiProperty({ name: 'generated_at', example: '2026-04-27T10:00:00Z' })
  public readonly generated_at!: Date;
}
