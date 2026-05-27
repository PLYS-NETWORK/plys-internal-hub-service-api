import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IBusinessActionCategory,
  IBusinessActionDisputeItem,
  IBusinessActionItemsResponse,
  IBusinessActionOverdueInvoiceItem,
  IBusinessActionOverdueTaskItem,
  IBusinessActionPendingTopUpItem,
  IBusinessActionTaskItem,
} from './interfaces/business-action-items.response.interface';

@Exclude()
export class BusinessActionTaskItemDto implements IBusinessActionTaskItem {
  @Expose()
  @ApiProperty({ name: 'task_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly task_id!: string;
  @Expose()
  @ApiProperty({ name: 'task_code', example: 'WEB-23' })
  public readonly task_code!: string;
  @Expose()
  @ApiProperty({ example: 'Implement password reset' })
  public readonly title!: string;
  @Expose()
  @ApiProperty({ name: 'project_id', example: '...' })
  public readonly project_id!: string;
  @Expose()
  @ApiProperty({ name: 'project_title', example: 'Marketing Site Revamp' })
  public readonly project_title!: string;
  @Expose()
  @ApiProperty({ name: 'submitted_at', example: '2026-05-15T10:00:00.000Z' })
  public readonly submitted_at!: string;
}

@Exclude()
export class BusinessActionOverdueTaskItemDto
  extends BusinessActionTaskItemDto
  implements IBusinessActionOverdueTaskItem
{
  @Expose()
  @ApiProperty({ name: 'due_date', example: '2026-05-10T00:00:00.000Z' })
  public readonly due_date!: string;
  @Expose()
  @ApiProperty({ name: 'days_overdue', example: 6 })
  public readonly days_overdue!: number;
}

@Exclude()
export class BusinessActionDisputeItemDto implements IBusinessActionDisputeItem {
  @Expose()
  @ApiProperty({ name: 'dispute_id' })
  public readonly dispute_id!: string;
  @Expose()
  @ApiProperty({ name: 'task_id' })
  public readonly task_id!: string;
  @Expose()
  @ApiProperty({ name: 'task_code', example: 'WEB-12' })
  public readonly task_code!: string;
  @Expose()
  @ApiProperty({ name: 'reason_snippet', example: 'Result missing the third deliverable…' })
  public readonly reason_snippet!: string;
  @Expose()
  @ApiProperty({ name: 'opened_at', example: '2026-05-14T08:30:00.000Z' })
  public readonly opened_at!: string;
}

@Exclude()
export class BusinessActionOverdueInvoiceItemDto implements IBusinessActionOverdueInvoiceItem {
  @Expose()
  @ApiProperty({ name: 'invoice_id' })
  public readonly invoice_id!: string;
  @Expose()
  @ApiProperty({ example: '480.00' })
  public readonly amount!: string;
  @Expose()
  @ApiProperty({ name: 'due_date', example: '2026-05-01T00:00:00.000Z' })
  public readonly due_date!: string;
  @Expose()
  @ApiProperty({ name: 'days_overdue', example: 15 })
  public readonly days_overdue!: number;
}

@Exclude()
export class BusinessActionPendingTopUpItemDto implements IBusinessActionPendingTopUpItem {
  @Expose()
  @ApiProperty({ name: 'transaction_id' })
  public readonly transaction_id!: string;
  @Expose()
  @ApiProperty({ name: 'transaction_number', example: 'PLSTOP202605120001' })
  public readonly transaction_number!: string;
  @Expose()
  @ApiProperty({ name: 'total_amount', example: '500.00' })
  public readonly total_amount!: string;
  @Expose()
  @ApiProperty({ name: 'created_at', example: '2026-05-12T15:00:00.000Z' })
  public readonly created_at!: string;
  @Expose()
  @ApiPropertyOptional({ name: 'redirect_url', nullable: true })
  public readonly redirect_url!: string | null;
}

@Exclude()
export class BusinessActionTaskCategoryDto implements IBusinessActionCategory<IBusinessActionTaskItem> {
  @Expose()
  @ApiProperty({ example: 5 })
  public readonly total!: number;
  @Expose()
  @Type(() => BusinessActionTaskItemDto)
  @ApiProperty({ type: BusinessActionTaskItemDto, isArray: true })
  public readonly items!: BusinessActionTaskItemDto[];
}

@Exclude()
export class BusinessActionOverdueTaskCategoryDto implements IBusinessActionCategory<IBusinessActionOverdueTaskItem> {
  @Expose()
  @ApiProperty({ example: 3 })
  public readonly total!: number;
  @Expose()
  @Type(() => BusinessActionOverdueTaskItemDto)
  @ApiProperty({ type: BusinessActionOverdueTaskItemDto, isArray: true })
  public readonly items!: BusinessActionOverdueTaskItemDto[];
}

@Exclude()
export class BusinessActionDisputeCategoryDto implements IBusinessActionCategory<IBusinessActionDisputeItem> {
  @Expose()
  @ApiProperty({ example: 1 })
  public readonly total!: number;
  @Expose()
  @Type(() => BusinessActionDisputeItemDto)
  @ApiProperty({ type: BusinessActionDisputeItemDto, isArray: true })
  public readonly items!: BusinessActionDisputeItemDto[];
}

@Exclude()
export class BusinessActionOverdueInvoiceCategoryDto implements IBusinessActionCategory<IBusinessActionOverdueInvoiceItem> {
  @Expose()
  @ApiProperty({ example: 2 })
  public readonly total!: number;
  @Expose()
  @Type(() => BusinessActionOverdueInvoiceItemDto)
  @ApiProperty({ type: BusinessActionOverdueInvoiceItemDto, isArray: true })
  public readonly items!: BusinessActionOverdueInvoiceItemDto[];
}

@Exclude()
export class BusinessActionPendingTopUpCategoryDto implements IBusinessActionCategory<IBusinessActionPendingTopUpItem> {
  @Expose()
  @ApiProperty({ example: 1 })
  public readonly total!: number;
  @Expose()
  @Type(() => BusinessActionPendingTopUpItemDto)
  @ApiProperty({ type: BusinessActionPendingTopUpItemDto, isArray: true })
  public readonly items!: BusinessActionPendingTopUpItemDto[];
}

@Exclude()
export class BusinessActionItemsResponseDto implements IBusinessActionItemsResponse {
  @Expose()
  @Type(() => BusinessActionTaskCategoryDto)
  @ApiProperty({ name: 'tasks_awaiting_review', type: BusinessActionTaskCategoryDto })
  public readonly tasks_awaiting_review!: BusinessActionTaskCategoryDto;

  @Expose()
  @Type(() => BusinessActionOverdueTaskCategoryDto)
  @ApiProperty({ name: 'overdue_tasks', type: BusinessActionOverdueTaskCategoryDto })
  public readonly overdue_tasks!: BusinessActionOverdueTaskCategoryDto;

  @Expose()
  @Type(() => BusinessActionDisputeCategoryDto)
  @ApiProperty({ name: 'open_disputes', type: BusinessActionDisputeCategoryDto })
  public readonly open_disputes!: BusinessActionDisputeCategoryDto;

  @Expose()
  @Type(() => BusinessActionOverdueInvoiceCategoryDto)
  @ApiProperty({ name: 'overdue_invoices', type: BusinessActionOverdueInvoiceCategoryDto })
  public readonly overdue_invoices!: BusinessActionOverdueInvoiceCategoryDto;

  @Expose()
  @Type(() => BusinessActionPendingTopUpCategoryDto)
  @ApiProperty({ name: 'pending_topups', type: BusinessActionPendingTopUpCategoryDto })
  public readonly pending_topups!: BusinessActionPendingTopUpCategoryDto;

  @Expose()
  @ApiProperty({ name: 'generated_at', example: '2026-05-16T10:12:30.123Z' })
  public readonly generated_at!: string;
}
