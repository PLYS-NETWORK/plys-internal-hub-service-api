import { OnboardingDecision, OnboardingStatus, SkillExamStatus } from '@database/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IConsultantDashboardActionCounts,
  IConsultantDashboardExams,
  IConsultantDashboardMoney,
  IConsultantDashboardOnboarding,
  IConsultantDashboardPerformance,
  IConsultantDashboardPortfolio,
  IConsultantDashboardSkills,
  IConsultantDashboardSummaryResponse,
} from './interfaces/consultant-dashboard-summary.response.interface';

@Exclude()
export class ConsultantDashboardMoneyDto implements IConsultantDashboardMoney {
  @Expose()
  @ApiProperty({ example: 'USD' })
  public readonly currency!: string;

  @Expose()
  @ApiProperty({ name: 'wallet_balance', example: '1850.00' })
  public readonly wallet_balance!: string;

  @Expose()
  @ApiProperty({ name: 'pending_credits', example: '320.00' })
  public readonly pending_credits!: string;

  @Expose()
  @ApiProperty({ name: 'cleared_credits_mtd', example: '4200.00' })
  public readonly cleared_credits_mtd!: string;

  @Expose()
  @ApiProperty({ name: 'total_withdrawn_mtd', example: '500.00' })
  public readonly total_withdrawn_mtd!: string;

  @Expose()
  @ApiProperty({ name: 'lifetime_earnings', example: '18200.00' })
  public readonly lifetime_earnings!: string;
}

@Exclude()
export class ConsultantDashboardPortfolioDto implements IConsultantDashboardPortfolio {
  @Expose()
  @ApiProperty({ name: 'active_projects', example: 3 })
  public readonly active_projects!: number;
  @Expose()
  @ApiProperty({ name: 'total_tasks_in_progress', example: 2 })
  public readonly total_tasks_in_progress!: number;
  @Expose()
  @ApiProperty({ name: 'total_tasks_in_review', example: 1 })
  public readonly total_tasks_in_review!: number;
  @Expose()
  @ApiProperty({ name: 'tasks_completed_mtd', example: 8 })
  public readonly tasks_completed_mtd!: number;
  @Expose()
  @ApiProperty({ name: 'tasks_overdue', example: 1 })
  public readonly tasks_overdue!: number;
}

@Exclude()
export class ConsultantDashboardPerformanceDto implements IConsultantDashboardPerformance {
  @Expose()
  @ApiPropertyOptional({ name: 'on_time_pct', example: '90.5', nullable: true })
  public readonly on_time_pct!: string | null;
  @Expose()
  @ApiPropertyOptional({ name: 'avg_cycle_days', example: '2.1', nullable: true })
  public readonly avg_cycle_days!: string | null;
  @Expose()
  @ApiPropertyOptional({ name: 'avg_rating', example: '4.7', nullable: true })
  public readonly avg_rating!: string | null;
  @Expose()
  @ApiProperty({ name: 'revisions_requested_count', example: 0 })
  public readonly revisions_requested_count!: number;
}

@Exclude()
export class ConsultantDashboardSkillsDto implements IConsultantDashboardSkills {
  @Expose()
  @ApiProperty({ name: 'verified_skills_count', example: 5 })
  public readonly verified_skills_count!: number;
  @Expose()
  @ApiProperty({ name: 'expert_count', example: 2 })
  public readonly expert_count!: number;
  @Expose()
  @ApiProperty({ name: 'senior_count', example: 2 })
  public readonly senior_count!: number;
  @Expose()
  @ApiProperty({ name: 'intermediate_count', example: 1 })
  public readonly intermediate_count!: number;
}

@Exclude()
export class ConsultantDashboardExamsDto implements IConsultantDashboardExams {
  @Expose()
  @ApiPropertyOptional({ name: 'active_exam_id', nullable: true })
  public readonly active_exam_id!: string | null;
  @Expose()
  @ApiPropertyOptional({ name: 'active_skill_name', nullable: true, example: 'skill_react' })
  public readonly active_skill_name!: string | null;
  @Expose()
  @ApiPropertyOptional({ name: 'active_status', enum: SkillExamStatus, nullable: true })
  public readonly active_status!: SkillExamStatus | null;
  @Expose()
  @ApiPropertyOptional({ name: 'expires_at', nullable: true, example: '2026-05-19T11:00:00.000Z' })
  public readonly expires_at!: string | null;
  @Expose()
  @ApiProperty({ name: 'total_passed_skills', example: 5 })
  public readonly total_passed_skills!: number;
}

@Exclude()
export class ConsultantDashboardOnboardingDto implements IConsultantDashboardOnboarding {
  @Expose()
  @ApiPropertyOptional({ enum: OnboardingStatus, nullable: true })
  public readonly status!: OnboardingStatus | null;
  @Expose()
  @ApiPropertyOptional({ enum: OnboardingDecision, nullable: true })
  public readonly decision!: OnboardingDecision | null;
  @Expose()
  @ApiPropertyOptional({ name: 'blocked_until', nullable: true })
  public readonly blocked_until!: string | null;
  @Expose()
  @ApiProperty({ name: 'is_approved', example: true })
  public readonly is_approved!: boolean;
}

@Exclude()
export class ConsultantDashboardActionCountsDto implements IConsultantDashboardActionCounts {
  @Expose()
  @ApiProperty({ name: 'revision_requested_tasks', example: 0 })
  public readonly revision_requested_tasks!: number;
  @Expose()
  @ApiProperty({ name: 'overdue_tasks', example: 1 })
  public readonly overdue_tasks!: number;
  @Expose()
  @ApiProperty({ name: 'pending_approval_tasks', example: 2 })
  public readonly pending_approval_tasks!: number;
  @Expose()
  @ApiProperty({ name: 'unread_notifications', example: 4 })
  public readonly unread_notifications!: number;
  @Expose()
  @ApiProperty({ name: 'pending_withdrawals', example: 0 })
  public readonly pending_withdrawals!: number;
}

@Exclude()
export class ConsultantDashboardSummaryResponseDto implements IConsultantDashboardSummaryResponse {
  @Expose()
  @Type(() => ConsultantDashboardMoneyDto)
  @ApiProperty({ type: ConsultantDashboardMoneyDto })
  public readonly money!: ConsultantDashboardMoneyDto;

  @Expose()
  @Type(() => ConsultantDashboardPortfolioDto)
  @ApiProperty({ type: ConsultantDashboardPortfolioDto })
  public readonly portfolio!: ConsultantDashboardPortfolioDto;

  @Expose()
  @Type(() => ConsultantDashboardPerformanceDto)
  @ApiProperty({ type: ConsultantDashboardPerformanceDto })
  public readonly performance!: ConsultantDashboardPerformanceDto;

  @Expose()
  @Type(() => ConsultantDashboardSkillsDto)
  @ApiProperty({ type: ConsultantDashboardSkillsDto })
  public readonly skills!: ConsultantDashboardSkillsDto;

  @Expose()
  @Type(() => ConsultantDashboardExamsDto)
  @ApiProperty({ type: ConsultantDashboardExamsDto })
  public readonly exams!: ConsultantDashboardExamsDto;

  @Expose()
  @Type(() => ConsultantDashboardOnboardingDto)
  @ApiProperty({ type: ConsultantDashboardOnboardingDto })
  public readonly onboarding!: ConsultantDashboardOnboardingDto;

  @Expose()
  @Type(() => ConsultantDashboardActionCountsDto)
  @ApiProperty({ name: 'action_counts', type: ConsultantDashboardActionCountsDto })
  public readonly action_counts!: ConsultantDashboardActionCountsDto;

  @Expose()
  @ApiProperty({ name: 'generated_at', example: '2026-05-16T10:12:30.123Z' })
  public readonly generated_at!: string;
}
