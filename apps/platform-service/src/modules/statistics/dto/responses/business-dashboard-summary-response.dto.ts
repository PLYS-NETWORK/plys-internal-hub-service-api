import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IBusinessDashboardActionCounts,
  IBusinessDashboardMoney,
  IBusinessDashboardPortfolio,
  IBusinessDashboardSummaryResponse,
  IBusinessDashboardTeam,
  IBusinessDashboardThroughput,
} from './interfaces/business-dashboard-summary.response.interface';

@Exclude()
export class BusinessDashboardMoneyDto implements IBusinessDashboardMoney {
  @Expose()
  @ApiProperty({ example: 'USD' })
  public readonly currency!: string;

  @Expose()
  @ApiProperty({ name: 'wallet_balance', example: '1850.00' })
  public readonly wallet_balance!: string;

  @Expose()
  @ApiProperty({ name: 'mtd_spend', example: '12300.00' })
  public readonly mtd_spend!: string;

  @Expose()
  @ApiProperty({ name: 'projected_monthly_bill', example: '4720.00' })
  public readonly projected_monthly_bill!: string;

  @Expose()
  @ApiProperty({ name: 'outstanding_invoices_amount', example: '910.00' })
  public readonly outstanding_invoices_amount!: string;

  @Expose()
  @ApiProperty({ name: 'outstanding_invoices_count', example: 2 })
  public readonly outstanding_invoices_count!: number;

  @Expose()
  @ApiProperty({ name: 'unpublished_pipeline_value', example: '2400.00' })
  public readonly unpublished_pipeline_value!: string;
}

@Exclude()
export class BusinessDashboardPortfolioDto implements IBusinessDashboardPortfolio {
  @Expose()
  @ApiProperty({ name: 'total_projects', example: 18 })
  public readonly total_projects!: number;
  @Expose()
  @ApiProperty({ name: 'active_projects', example: 9 })
  public readonly active_projects!: number;
  @Expose()
  @ApiProperty({ name: 'completed_projects', example: 6 })
  public readonly completed_projects!: number;
  @Expose()
  @ApiProperty({ name: 'at_risk_count', example: 2 })
  public readonly at_risk_count!: number;
}

@Exclude()
export class BusinessDashboardThroughputDto implements IBusinessDashboardThroughput {
  @Expose()
  @ApiProperty({ name: 'tasks_completed_mtd', example: 41 })
  public readonly tasks_completed_mtd!: number;
  @Expose()
  @ApiProperty({ name: 'tasks_in_review', example: 5 })
  public readonly tasks_in_review!: number;
  @Expose()
  @ApiProperty({ name: 'tasks_overdue', example: 3 })
  public readonly tasks_overdue!: number;
  @Expose()
  @ApiProperty({ name: 'avg_cycle_days', example: '2.4', nullable: true })
  public readonly avg_cycle_days!: string | null;
  @Expose()
  @ApiProperty({ name: 'on_time_delivery_pct', example: '87.5', nullable: true })
  public readonly on_time_delivery_pct!: string | null;
}

@Exclude()
export class BusinessDashboardTeamDto implements IBusinessDashboardTeam {
  @Expose()
  @ApiProperty({ name: 'active_consultants', example: 12 })
  public readonly active_consultants!: number;
  @Expose()
  @ApiProperty({ name: 'new_consultants_mtd', example: 3 })
  public readonly new_consultants_mtd!: number;
}

@Exclude()
export class BusinessDashboardActionCountsDto implements IBusinessDashboardActionCounts {
  @Expose()
  @ApiProperty({ name: 'tasks_awaiting_review', example: 5 })
  public readonly tasks_awaiting_review!: number;
  @Expose()
  @ApiProperty({ name: 'overdue_tasks', example: 3 })
  public readonly overdue_tasks!: number;
  @Expose()
  @ApiProperty({ name: 'open_disputes', example: 1 })
  public readonly open_disputes!: number;
  @Expose()
  @ApiProperty({ name: 'overdue_invoices', example: 2 })
  public readonly overdue_invoices!: number;
  @Expose()
  @ApiProperty({ name: 'pending_topups', example: 1 })
  public readonly pending_topups!: number;
}

@Exclude()
export class BusinessDashboardSummaryResponseDto implements IBusinessDashboardSummaryResponse {
  @Expose()
  @Type(() => BusinessDashboardMoneyDto)
  @ApiProperty({ type: BusinessDashboardMoneyDto })
  public readonly money!: BusinessDashboardMoneyDto;

  @Expose()
  @Type(() => BusinessDashboardPortfolioDto)
  @ApiProperty({ type: BusinessDashboardPortfolioDto })
  public readonly portfolio!: BusinessDashboardPortfolioDto;

  @Expose()
  @Type(() => BusinessDashboardThroughputDto)
  @ApiProperty({ type: BusinessDashboardThroughputDto })
  public readonly throughput!: BusinessDashboardThroughputDto;

  @Expose()
  @Type(() => BusinessDashboardTeamDto)
  @ApiProperty({ type: BusinessDashboardTeamDto })
  public readonly team!: BusinessDashboardTeamDto;

  @Expose()
  @Type(() => BusinessDashboardActionCountsDto)
  @ApiProperty({ name: 'action_counts', type: BusinessDashboardActionCountsDto })
  public readonly action_counts!: BusinessDashboardActionCountsDto;

  @Expose()
  @ApiProperty({ name: 'generated_at', example: '2026-05-16T10:12:30.123Z' })
  public readonly generated_at!: string;
}
