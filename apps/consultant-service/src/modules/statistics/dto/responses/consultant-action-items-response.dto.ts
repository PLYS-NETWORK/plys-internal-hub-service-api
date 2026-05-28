import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IConsultantActionCategory,
  IConsultantActionItemsResponse,
  IConsultantActionNotificationItem,
  IConsultantActionOverdueTaskItem,
  IConsultantActionPendingApprovalTaskItem,
  IConsultantActionPendingWithdrawalItem,
  IConsultantActionRevisionTaskItem,
  IConsultantActionTaskItem,
} from './interfaces/consultant-action-items.response.interface';

@Exclude()
export class ConsultantActionTaskItemDto implements IConsultantActionTaskItem {
  @Expose()
  @ApiProperty({ name: 'task_id' })
  public readonly task_id!: string;
  @Expose()
  @ApiProperty({ name: 'task_code', example: 'WEB-23' })
  public readonly task_code!: string;
  @Expose()
  @ApiProperty({ example: 'Implement password reset' })
  public readonly title!: string;
  @Expose()
  @ApiProperty({ name: 'project_id' })
  public readonly project_id!: string;
  @Expose()
  @ApiProperty({ name: 'project_title', example: 'Marketing Site Revamp' })
  public readonly project_title!: string;
  @Expose()
  @ApiProperty({ name: 'kanban_status', example: 'in_review' })
  public readonly kanban_status!: string;
}

@Exclude()
export class ConsultantActionRevisionTaskItemDto
  extends ConsultantActionTaskItemDto
  implements IConsultantActionRevisionTaskItem
{
  @Expose()
  @ApiPropertyOptional({ name: 'due_date', nullable: true, example: '2026-05-20T00:00:00.000Z' })
  public readonly due_date!: string | null;
  @Expose()
  @ApiProperty({ name: 'last_revision_requested_at', example: '2026-05-15T10:00:00.000Z' })
  public readonly last_revision_requested_at!: string;
}

@Exclude()
export class ConsultantActionOverdueTaskItemDto
  extends ConsultantActionTaskItemDto
  implements IConsultantActionOverdueTaskItem
{
  @Expose()
  @ApiProperty({ name: 'due_date', example: '2026-05-10T00:00:00.000Z' })
  public readonly due_date!: string;
  @Expose()
  @ApiProperty({ name: 'days_overdue', example: 6 })
  public readonly days_overdue!: number;
}

@Exclude()
export class ConsultantActionPendingApprovalTaskItemDto
  extends ConsultantActionTaskItemDto
  implements IConsultantActionPendingApprovalTaskItem
{
  @Expose()
  @ApiProperty({ name: 'submitted_at', example: '2026-05-13T10:00:00.000Z' })
  public readonly submitted_at!: string;
  @Expose()
  @ApiProperty({ name: 'days_waiting', example: 3 })
  public readonly days_waiting!: number;
}

@Exclude()
export class ConsultantActionNotificationItemDto implements IConsultantActionNotificationItem {
  @Expose()
  @ApiProperty({ name: 'notification_id' })
  public readonly notification_id!: string;
  @Expose()
  @ApiProperty({ example: 'task_revision_requested' })
  public readonly type!: string;
  @Expose()
  @ApiProperty({ example: 'Revision requested on WEB-12' })
  public readonly title!: string;
  @Expose()
  @ApiProperty({ example: 'The business owner requested changes on your task.' })
  public readonly body!: string;
  @Expose()
  @ApiPropertyOptional({ name: 'redirect_url', nullable: true })
  public readonly redirect_url!: string | null;
  @Expose()
  @ApiProperty({ name: 'created_at', example: '2026-05-15T10:00:00.000Z' })
  public readonly created_at!: string;
}

@Exclude()
export class ConsultantActionPendingWithdrawalItemDto implements IConsultantActionPendingWithdrawalItem {
  @Expose()
  @ApiProperty({ name: 'transaction_id' })
  public readonly transaction_id!: string;
  @Expose()
  @ApiProperty({ name: 'transaction_number', example: 'PLNWDR202605120001' })
  public readonly transaction_number!: string;
  @Expose()
  @ApiProperty({ example: '250.00' })
  public readonly amount!: string;
  @Expose()
  @ApiPropertyOptional({ name: 'withdrawal_method', nullable: true, example: 'stripe_connect' })
  public readonly withdrawal_method!: string | null;
  @Expose()
  @ApiProperty({ name: 'created_at', example: '2026-05-15T10:00:00.000Z' })
  public readonly created_at!: string;
}

@Exclude()
export class ConsultantActionRevisionCategoryDto implements IConsultantActionCategory<IConsultantActionRevisionTaskItem> {
  @Expose()
  @ApiProperty({ example: 1 })
  public readonly total!: number;
  @Expose()
  @Type(() => ConsultantActionRevisionTaskItemDto)
  @ApiProperty({ type: ConsultantActionRevisionTaskItemDto, isArray: true })
  public readonly items!: ConsultantActionRevisionTaskItemDto[];
}

@Exclude()
export class ConsultantActionOverdueCategoryDto implements IConsultantActionCategory<IConsultantActionOverdueTaskItem> {
  @Expose()
  @ApiProperty({ example: 2 })
  public readonly total!: number;
  @Expose()
  @Type(() => ConsultantActionOverdueTaskItemDto)
  @ApiProperty({ type: ConsultantActionOverdueTaskItemDto, isArray: true })
  public readonly items!: ConsultantActionOverdueTaskItemDto[];
}

@Exclude()
export class ConsultantActionPendingApprovalCategoryDto implements IConsultantActionCategory<IConsultantActionPendingApprovalTaskItem> {
  @Expose()
  @ApiProperty({ example: 3 })
  public readonly total!: number;
  @Expose()
  @Type(() => ConsultantActionPendingApprovalTaskItemDto)
  @ApiProperty({ type: ConsultantActionPendingApprovalTaskItemDto, isArray: true })
  public readonly items!: ConsultantActionPendingApprovalTaskItemDto[];
}

@Exclude()
export class ConsultantActionNotificationCategoryDto implements IConsultantActionCategory<IConsultantActionNotificationItem> {
  @Expose()
  @ApiProperty({ example: 7 })
  public readonly total!: number;
  @Expose()
  @Type(() => ConsultantActionNotificationItemDto)
  @ApiProperty({ type: ConsultantActionNotificationItemDto, isArray: true })
  public readonly items!: ConsultantActionNotificationItemDto[];
}

@Exclude()
export class ConsultantActionPendingWithdrawalCategoryDto implements IConsultantActionCategory<IConsultantActionPendingWithdrawalItem> {
  @Expose()
  @ApiProperty({ example: 1 })
  public readonly total!: number;
  @Expose()
  @Type(() => ConsultantActionPendingWithdrawalItemDto)
  @ApiProperty({ type: ConsultantActionPendingWithdrawalItemDto, isArray: true })
  public readonly items!: ConsultantActionPendingWithdrawalItemDto[];
}

@Exclude()
export class ConsultantActionItemsResponseDto implements IConsultantActionItemsResponse {
  @Expose()
  @Type(() => ConsultantActionRevisionCategoryDto)
  @ApiProperty({ name: 'revision_requested_tasks', type: ConsultantActionRevisionCategoryDto })
  public readonly revision_requested_tasks!: ConsultantActionRevisionCategoryDto;

  @Expose()
  @Type(() => ConsultantActionOverdueCategoryDto)
  @ApiProperty({ name: 'overdue_tasks', type: ConsultantActionOverdueCategoryDto })
  public readonly overdue_tasks!: ConsultantActionOverdueCategoryDto;

  @Expose()
  @Type(() => ConsultantActionPendingApprovalCategoryDto)
  @ApiProperty({ name: 'pending_approval_tasks', type: ConsultantActionPendingApprovalCategoryDto })
  public readonly pending_approval_tasks!: ConsultantActionPendingApprovalCategoryDto;

  @Expose()
  @Type(() => ConsultantActionNotificationCategoryDto)
  @ApiProperty({ name: 'recent_notifications', type: ConsultantActionNotificationCategoryDto })
  public readonly recent_notifications!: ConsultantActionNotificationCategoryDto;

  @Expose()
  @Type(() => ConsultantActionPendingWithdrawalCategoryDto)
  @ApiProperty({ name: 'pending_withdrawals', type: ConsultantActionPendingWithdrawalCategoryDto })
  public readonly pending_withdrawals!: ConsultantActionPendingWithdrawalCategoryDto;

  @Expose()
  @ApiProperty({ name: 'generated_at', example: '2026-05-16T10:12:30.123Z' })
  public readonly generated_at!: string;
}
