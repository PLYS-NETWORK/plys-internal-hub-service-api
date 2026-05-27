import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IAdminDashboardSummaryResponse,
  IAdminFinancialSummary,
  IAdminGrowthSummary,
  IAdminOperationalQueuesSummary,
  IAdminUsersStatusCounts,
  IAdminUsersSummary,
} from './interfaces/admin-dashboard-summary.response.interface';

@Exclude()
export class AdminUsersStatusCountsDto implements IAdminUsersStatusCounts {
  @Expose()
  @ApiProperty({ example: 1240 })
  public readonly total!: number;

  @Expose()
  @ApiProperty({ name: 'active_30d', example: 812 })
  public readonly active_30d!: number;

  @Expose()
  @ApiProperty({ example: 28 })
  public readonly unverified!: number;

  @Expose()
  @ApiProperty({ example: 4 })
  public readonly banned!: number;
}

@Exclude()
export class AdminUsersSummaryDto implements IAdminUsersSummary {
  @Expose()
  @Type(() => AdminUsersStatusCountsDto)
  @ApiProperty({ type: AdminUsersStatusCountsDto })
  public readonly business!: AdminUsersStatusCountsDto;

  @Expose()
  @Type(() => AdminUsersStatusCountsDto)
  @ApiProperty({ type: AdminUsersStatusCountsDto })
  public readonly consultant!: AdminUsersStatusCountsDto;
}

@Exclude()
export class AdminFinancialSummaryDto implements IAdminFinancialSummary {
  @Expose()
  @ApiProperty({ example: 'USD' })
  public readonly currency!: string;

  @Expose()
  @ApiProperty({ name: 'mtd_gmv', example: '245100.00' })
  public readonly mtd_gmv!: string;

  @Expose()
  @ApiProperty({ name: 'mtd_payouts', example: '118420.00' })
  public readonly mtd_payouts!: string;

  @Expose()
  @ApiProperty({ name: 'outstanding_payouts', example: '42305.00' })
  public readonly outstanding_payouts!: string;

  @Expose()
  @ApiProperty({ name: 'outstanding_invoices', example: '8910.00' })
  public readonly outstanding_invoices!: string;
}

@Exclude()
export class AdminOperationalQueuesSummaryDto implements IAdminOperationalQueuesSummary {
  @Expose()
  @ApiProperty({ name: 'pending_consultant_onboardings', example: 14 })
  public readonly pending_consultant_onboardings!: number;

  @Expose()
  @ApiProperty({ name: 'skill_exams_awaiting_review', example: 7 })
  public readonly skill_exams_awaiting_review!: number;

  @Expose()
  @ApiProperty({ name: 'open_task_disputes', example: 3 })
  public readonly open_task_disputes!: number;

  @Expose()
  @ApiProperty({ name: 'overdue_invoices', example: 5 })
  public readonly overdue_invoices!: number;

  @Expose()
  @ApiProperty({ name: 'pending_consultant_withdrawals', example: 9 })
  public readonly pending_consultant_withdrawals!: number;
}

@Exclude()
export class AdminGrowthSummaryDto implements IAdminGrowthSummary {
  @Expose()
  @ApiProperty({ name: 'new_consultants_mtd', example: 87 })
  public readonly new_consultants_mtd!: number;

  @Expose()
  @ApiProperty({ name: 'new_businesses_mtd', example: 21 })
  public readonly new_businesses_mtd!: number;

  @Expose()
  @ApiProperty({ name: 'gmv_delta_pct', example: '12.4' })
  public readonly gmv_delta_pct!: string;

  @Expose()
  @ApiProperty({ name: 'payouts_delta_pct', example: '9.1' })
  public readonly payouts_delta_pct!: string;
}

@Exclude()
export class AdminDashboardSummaryResponseDto implements IAdminDashboardSummaryResponse {
  @Expose()
  @Type(() => AdminUsersSummaryDto)
  @ApiProperty({ type: AdminUsersSummaryDto })
  public readonly users!: AdminUsersSummaryDto;

  @Expose()
  @Type(() => AdminFinancialSummaryDto)
  @ApiProperty({ type: AdminFinancialSummaryDto })
  public readonly financial!: AdminFinancialSummaryDto;

  @Expose()
  @Type(() => AdminOperationalQueuesSummaryDto)
  @ApiProperty({ type: AdminOperationalQueuesSummaryDto })
  public readonly queues!: AdminOperationalQueuesSummaryDto;

  @Expose()
  @Type(() => AdminGrowthSummaryDto)
  @ApiProperty({ type: AdminGrowthSummaryDto })
  public readonly growth!: AdminGrowthSummaryDto;

  @Expose()
  @ApiProperty({ name: 'generated_at', example: '2026-05-16T10:12:30.123Z' })
  public readonly generated_at!: string;
}
