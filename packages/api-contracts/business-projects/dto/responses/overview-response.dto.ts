import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ProficiencyLevel,
  ProjectActivityEventType,
  ProjectMemberActiveStatus,
  ProjectPaymentType,
  ProjectStatus,
} from '@plys/libraries/database/enums';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IOverviewActionCategory,
  IOverviewActionItemDispute,
  IOverviewActionItems,
  IOverviewActionItemTask,
  IOverviewActivityEvent,
  IOverviewHealth,
  IOverviewMoney,
  IOverviewResponse,
  IOverviewSummary,
  IOverviewTeamMember,
  IOverviewTeamSkill,
} from './interfaces/overview.response.interface';

@Exclude()
export class OverviewSummaryDto implements IOverviewSummary {
  @Expose() @ApiProperty() public readonly id!: string;
  @Expose() @ApiProperty({ example: 'WEB' }) public readonly code!: string;
  @Expose() @ApiProperty({ example: 'Marketing Site Revamp' }) public readonly title!: string;
  @Expose() @ApiProperty({ enum: ProjectStatus }) public readonly status!: ProjectStatus;
  @Expose()
  @ApiProperty({ name: 'payment_type', enum: ProjectPaymentType })
  public readonly payment_type!: ProjectPaymentType;
  @Expose()
  @ApiProperty({ name: 'business_company_name', example: 'Acme Co.' })
  public readonly business_company_name!: string;
  @Expose()
  @ApiProperty({ name: 'required_consultants', example: 4 })
  public readonly required_consultants!: number;
  @Expose() @ApiProperty({ name: 'created_at' }) public readonly created_at!: string;
  @Expose()
  @ApiPropertyOptional({ name: 'published_at', nullable: true })
  public readonly published_at!: string | null;
  @Expose()
  @ApiPropertyOptional({ name: 'started_at', nullable: true })
  public readonly started_at!: string | null;
  @Expose()
  @ApiPropertyOptional({ name: 'completed_at', nullable: true })
  public readonly completed_at!: string | null;
}

@Exclude()
export class OverviewHealthDto implements IOverviewHealth {
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
  @ApiProperty({ name: 'in_progress_tasks', example: 5 })
  public readonly in_progress_tasks!: number;
  @Expose()
  @ApiProperty({ name: 'overdue_tasks', example: 1 })
  public readonly overdue_tasks!: number;
  @Expose()
  @ApiPropertyOptional({ name: 'completion_pct', example: '38.9', nullable: true })
  public readonly completion_pct!: string | null;
  @Expose()
  @ApiProperty({ name: 'tasks_completed_last_7d', example: 4 })
  public readonly tasks_completed_last_7d!: number;
  @Expose()
  @ApiProperty({ name: 'open_disputes', example: 1 })
  public readonly open_disputes!: number;
  @Expose()
  @ApiProperty({ name: 'is_at_risk', example: true })
  public readonly is_at_risk!: boolean;
  @Expose()
  @ApiPropertyOptional({ name: 'last_activity_at', nullable: true })
  public readonly last_activity_at!: string | null;
}

@Exclude()
export class OverviewMoneyDto implements IOverviewMoney {
  @Expose() @ApiProperty({ example: 'USD' }) public readonly currency!: string;
  @Expose()
  @ApiProperty({ name: 'spent_on_publish', example: '100.00' })
  public readonly spent_on_publish!: string;
  @Expose()
  @ApiProperty({ name: 'spent_on_tasks', example: '1840.00' })
  public readonly spent_on_tasks!: string;
  @Expose()
  @ApiProperty({ name: 'total_spent', example: '1940.00' })
  public readonly total_spent!: string;
  @Expose()
  @ApiProperty({ name: 'unpublished_pipeline_value', example: '620.00' })
  public readonly unpublished_pipeline_value!: string;
  @Expose()
  @ApiPropertyOptional({ name: 'projected_monthly_bill', example: '480.00', nullable: true })
  public readonly projected_monthly_bill!: string | null;
}

@Exclude()
export class OverviewTeamSkillDto implements IOverviewTeamSkill {
  @Expose() @ApiProperty({ name: 'skill_id' }) public readonly skill_id!: string;
  @Expose()
  @ApiProperty({ name: 'skill_name', example: 'skill_typescript' })
  public readonly skill_name!: string;
  @Expose()
  @ApiPropertyOptional({ name: 'proficiency_level', enum: ProficiencyLevel, nullable: true })
  public readonly proficiency_level!: ProficiencyLevel | null;
  @Expose()
  @ApiPropertyOptional({ example: '82.00', nullable: true })
  public readonly rating!: string | null;
  @Expose()
  @ApiProperty({ name: 'is_required', example: true })
  public readonly is_required!: boolean;
}

@Exclude()
export class OverviewTeamMemberDto implements IOverviewTeamMember {
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
  @ApiProperty({ name: 'active_status', enum: ProjectMemberActiveStatus })
  public readonly active_status!: ProjectMemberActiveStatus;
  @Expose() @ApiProperty({ name: 'joined_at' }) public readonly joined_at!: string;
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
  @Expose()
  @Type(() => OverviewTeamSkillDto)
  @ApiProperty({ type: OverviewTeamSkillDto, isArray: true })
  public readonly skills!: OverviewTeamSkillDto[];
}

@Exclude()
export class OverviewActionItemTaskDto implements IOverviewActionItemTask {
  @Expose() @ApiProperty({ name: 'task_id' }) public readonly task_id!: string;
  @Expose()
  @ApiProperty({ name: 'task_code', example: 'WEB-23' })
  public readonly task_code!: string;
  @Expose() @ApiProperty() public readonly title!: string;
  @Expose() @ApiProperty({ name: 'reference_at' }) public readonly reference_at!: string;
  @Expose()
  @ApiPropertyOptional({ name: 'days_overdue', example: 6, nullable: true })
  public readonly days_overdue!: number | null;
}

@Exclude()
export class OverviewActionItemDisputeDto implements IOverviewActionItemDispute {
  @Expose() @ApiProperty({ name: 'dispute_id' }) public readonly dispute_id!: string;
  @Expose() @ApiProperty({ name: 'task_id' }) public readonly task_id!: string;
  @Expose()
  @ApiProperty({ name: 'task_code', example: 'WEB-12' })
  public readonly task_code!: string;
  @Expose()
  @ApiProperty({ name: 'reason_snippet', example: 'Result missing…' })
  public readonly reason_snippet!: string;
  @Expose() @ApiProperty({ name: 'opened_at' }) public readonly opened_at!: string;
}

@Exclude()
export class OverviewActionTaskCategoryDto implements IOverviewActionCategory<IOverviewActionItemTask> {
  @Expose() @ApiProperty({ example: 5 }) public readonly total!: number;
  @Expose()
  @Type(() => OverviewActionItemTaskDto)
  @ApiProperty({ type: OverviewActionItemTaskDto, isArray: true })
  public readonly items!: OverviewActionItemTaskDto[];
}

@Exclude()
export class OverviewActionDisputeCategoryDto implements IOverviewActionCategory<IOverviewActionItemDispute> {
  @Expose() @ApiProperty({ example: 1 }) public readonly total!: number;
  @Expose()
  @Type(() => OverviewActionItemDisputeDto)
  @ApiProperty({ type: OverviewActionItemDisputeDto, isArray: true })
  public readonly items!: OverviewActionItemDisputeDto[];
}

@Exclude()
export class OverviewActionItemsDto implements IOverviewActionItems {
  @Expose()
  @Type(() => OverviewActionTaskCategoryDto)
  @ApiProperty({ name: 'tasks_awaiting_review', type: OverviewActionTaskCategoryDto })
  public readonly tasks_awaiting_review!: OverviewActionTaskCategoryDto;
  @Expose()
  @Type(() => OverviewActionTaskCategoryDto)
  @ApiProperty({ name: 'overdue_tasks', type: OverviewActionTaskCategoryDto })
  public readonly overdue_tasks!: OverviewActionTaskCategoryDto;
  @Expose()
  @Type(() => OverviewActionDisputeCategoryDto)
  @ApiProperty({ name: 'open_disputes', type: OverviewActionDisputeCategoryDto })
  public readonly open_disputes!: OverviewActionDisputeCategoryDto;
}

@Exclude()
export class OverviewActivityEventDto implements IOverviewActivityEvent {
  @Expose()
  @ApiProperty({ name: 'event_type', enum: ProjectActivityEventType })
  public readonly event_type!: ProjectActivityEventType;
  @Expose() @ApiProperty({ name: 'event_id' }) public readonly event_id!: string;
  @Expose() @ApiProperty({ name: 'occurred_at' }) public readonly occurred_at!: Date;
  @Expose()
  @ApiProperty()
  public readonly actor!: { user_id: string | null; name: string | null };
  @Expose()
  @ApiProperty({ type: 'object', additionalProperties: true })
  public readonly payload!: Record<string, unknown>;
}

@Exclude()
export class OverviewResponseDto implements IOverviewResponse {
  @Expose()
  @Type(() => OverviewSummaryDto)
  @ApiProperty({ type: () => OverviewSummaryDto })
  public readonly summary!: OverviewSummaryDto;

  @Expose()
  @Type(() => OverviewHealthDto)
  @ApiProperty({ type: () => OverviewHealthDto })
  public readonly health!: OverviewHealthDto;

  @Expose()
  @Type(() => OverviewMoneyDto)
  @ApiProperty({ type: () => OverviewMoneyDto })
  public readonly money!: OverviewMoneyDto;

  @Expose()
  @Type(() => OverviewTeamMemberDto)
  @ApiProperty({ type: () => OverviewTeamMemberDto, isArray: true })
  public readonly team!: OverviewTeamMemberDto[];

  @Expose()
  @Type(() => OverviewActionItemsDto)
  @ApiProperty({ name: 'action_items', type: () => OverviewActionItemsDto })
  public readonly action_items!: OverviewActionItemsDto;

  @Expose()
  @Type(() => OverviewActivityEventDto)
  @ApiProperty({ type: () => OverviewActivityEventDto, isArray: true })
  public readonly activity!: OverviewActivityEventDto[];

  @Expose() @ApiProperty({ name: 'generated_at' }) public readonly generated_at!: string;
}
