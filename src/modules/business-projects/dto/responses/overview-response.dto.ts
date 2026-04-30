import {
  ProjectActivityEventType,
  ProjectMemberActiveStatus,
  ProjectStatus,
} from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IOverviewActivityEvent,
  IOverviewApplicationBreakdown,
  IOverviewResponse,
  IOverviewStatistics,
  IOverviewSummary,
  IOverviewTaskStatuses,
  IOverviewTeamMember,
} from './interfaces/overview.response.interface';

@Exclude()
export class OverviewSummaryDto implements IOverviewSummary {
  @Expose()
  @ApiProperty({ example: 'AI customer support automation' })
  public readonly title!: string;

  @Expose()
  @ApiProperty({ name: 'created_at' })
  public readonly created_at!: Date;

  @Expose()
  @ApiProperty({ name: 'updated_at' })
  public readonly updated_at!: Date;

  @Expose()
  @ApiProperty({ name: 'published_at', nullable: true })
  public readonly published_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'business_company_name', example: 'Acme Corp' })
  public readonly business_company_name!: string;

  @Expose()
  @ApiProperty({ enum: ProjectStatus })
  public readonly status!: ProjectStatus;

  @Expose()
  @ApiProperty({
    name: 'project_cost',
    example: '5000.00',
    description: 'Pre-commission task total',
  })
  public readonly project_cost!: string;
}

@Exclude()
export class OverviewStatisticsDto implements IOverviewStatistics {
  @Expose()
  @ApiProperty({ name: 'total_tasks', example: 12 })
  public readonly total_tasks!: number;

  @Expose()
  @ApiProperty({ name: 'completed_tasks', example: 5 })
  public readonly completed_tasks!: number;

  @Expose()
  @ApiProperty({ name: 'in_progress_tasks', example: 3 })
  public readonly in_progress_tasks!: number;

  @Expose()
  @ApiProperty({ name: 'total_project_members', example: 4 })
  public readonly total_project_members!: number;

  @Expose()
  @ApiProperty({ name: 'total_pending_applications', example: 7 })
  public readonly total_pending_applications!: number;

  @Expose()
  @ApiProperty({ name: 'total_applications', example: 20 })
  public readonly total_applications!: number;

  @Expose()
  @ApiProperty({ name: 'total_approved', example: 4 })
  public readonly total_approved!: number;

  @Expose()
  @ApiProperty({ name: 'total_rejected', example: 8 })
  public readonly total_rejected!: number;
}

@Exclude()
export class OverviewTaskStatusesDto implements IOverviewTaskStatuses {
  @Expose() @ApiProperty({ example: 2 }) public readonly draft!: number;
  @Expose() @ApiProperty({ name: 'to_do', example: 3 }) public readonly to_do!: number;
  @Expose() @ApiProperty({ example: 1 }) public readonly assigned!: number;
  @Expose() @ApiProperty({ name: 'in_progress', example: 4 }) public readonly in_progress!: number;
  @Expose() @ApiProperty({ name: 'in_review', example: 1 }) public readonly in_review!: number;
  @Expose()
  @ApiProperty({ name: 'pending_approval', example: 0 })
  public readonly pending_approval!: number;
  @Expose()
  @ApiProperty({ name: 'revision_requested', example: 0 })
  public readonly revision_requested!: number;
  @Expose() @ApiProperty({ example: 1 }) public readonly done!: number;
  @Expose() @ApiProperty({ example: 0 }) public readonly cancelled!: number;
}

@Exclude()
export class OverviewTeamMemberDto implements IOverviewTeamMember {
  @Expose()
  @ApiProperty({ name: 'consultant_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly consultant_id!: string;

  @Expose()
  @ApiProperty({ name: 'full_name', example: 'Jane Doe' })
  public readonly full_name!: string;

  @Expose()
  @ApiProperty({ name: 'avatar_url', nullable: true })
  public readonly avatar_url!: string | null;

  @Expose()
  @ApiProperty({ name: 'active_status', enum: ProjectMemberActiveStatus })
  public readonly active_status!: ProjectMemberActiveStatus;
}

@Exclude()
export class OverviewApplicationBreakdownDto implements IOverviewApplicationBreakdown {
  @Expose() @ApiProperty({ example: 5 }) public readonly pending!: number;
  @Expose() @ApiProperty({ example: 3 }) public readonly accepted!: number;
  @Expose() @ApiProperty({ example: 2 }) public readonly rejected!: number;
  @Expose() @ApiProperty({ example: 1 }) public readonly withdrawn!: number;

  @Expose()
  @ApiProperty({
    name: 'approval_rate',
    example: 60,
    nullable: true,
    description: 'accepted / (accepted + rejected) × 100, rounded. null when denominator is 0.',
  })
  public readonly approval_rate!: number | null;
}

@Exclude()
export class OverviewActivityEventDto implements IOverviewActivityEvent {
  @Expose()
  @ApiProperty({ name: 'event_type', enum: ProjectActivityEventType })
  public readonly event_type!: ProjectActivityEventType;

  @Expose()
  @ApiProperty({ name: 'event_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly event_id!: string;

  @Expose()
  @ApiProperty({ name: 'occurred_at' })
  public readonly occurred_at!: Date;

  @Expose()
  @ApiProperty({
    description: 'Either both fields populated or both null for system events.',
  })
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
  @Type(() => OverviewStatisticsDto)
  @ApiProperty({ type: () => OverviewStatisticsDto })
  public readonly statistics!: OverviewStatisticsDto;

  @Expose()
  @Type(() => OverviewTaskStatusesDto)
  @ApiProperty({ name: 'task_statuses', type: () => OverviewTaskStatusesDto })
  public readonly task_statuses!: OverviewTaskStatusesDto;

  @Expose()
  @Type(() => OverviewTeamMemberDto)
  @ApiProperty({ name: 'team_members', type: () => OverviewTeamMemberDto, isArray: true })
  public readonly team_members!: OverviewTeamMemberDto[];

  @Expose()
  @Type(() => OverviewApplicationBreakdownDto)
  @ApiProperty({ name: 'application_breakdown', type: () => OverviewApplicationBreakdownDto })
  public readonly application_breakdown!: OverviewApplicationBreakdownDto;

  @Expose()
  @Type(() => OverviewActivityEventDto)
  @ApiProperty({ name: 'recent_activity', type: () => OverviewActivityEventDto, isArray: true })
  public readonly recent_activity!: OverviewActivityEventDto[];
}
