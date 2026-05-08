import { TaskKanbanStatus } from '@database/enums';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export type BoardTaskSortBy = 'total_worked_hours' | 'created_at' | 'updated_at';
export type BoardTaskOrderBy = 'ASC' | 'DESC';

const KEYWORDS_MIN = 2;
const KEYWORDS_MAX = 200;

const SORT_BY_VALUES: readonly BoardTaskSortBy[] = [
  'total_worked_hours',
  'created_at',
  'updated_at',
];
const ORDER_BY_VALUES: readonly BoardTaskOrderBy[] = ['ASC', 'DESC'];

/** Sentinel accepted on `assignee_id` to filter for unassigned tasks. */
export const ASSIGNEE_ID_UNASSIGNED = 'unassigned';

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
  }
  return value;
};

const toUpper = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.toUpperCase() : value;

export class ListBoardTasksDto {
  @Expose({ name: 'status' })
  @ApiPropertyOptional({
    name: 'status',
    enum: TaskKanbanStatus,
    description: 'Optional kanban status filter. DRAFT is always rejected.',
  })
  @IsEnum(TaskKanbanStatus)
  @IsOptional()
  public readonly status?: TaskKanbanStatus;

  @Expose({ name: 'assignee_id' })
  @ApiPropertyOptional({
    name: 'assignee_id',
    description:
      'Filter by ConsultantProfile UUID. Pass the literal string `unassigned` to return only tasks with no assignee.',
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  public readonly assigneeId?: string;

  @Expose({ name: 'keywords' })
  @ApiPropertyOptional({
    name: 'keywords',
    description: 'Case-insensitive substring search on task title or task code.',
    minLength: KEYWORDS_MIN,
    maxLength: KEYWORDS_MAX,
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(KEYWORDS_MIN)
  @MaxLength(KEYWORDS_MAX)
  @IsOptional()
  public readonly keywords?: string;

  @Expose({ name: 'sort_by' })
  @ApiPropertyOptional({
    name: 'sort_by',
    enum: SORT_BY_VALUES,
    default: 'updated_at',
  })
  @IsIn(SORT_BY_VALUES as readonly string[])
  @IsOptional()
  public readonly sortBy?: BoardTaskSortBy;

  @Expose({ name: 'order_by' })
  @ApiPropertyOptional({
    name: 'order_by',
    enum: ORDER_BY_VALUES,
    default: 'DESC',
  })
  @Transform(toUpper)
  @IsIn(ORDER_BY_VALUES as readonly string[])
  @IsOptional()
  public readonly orderBy?: BoardTaskOrderBy;

  @Expose({ name: 'is_remove_cache' })
  @ApiPropertyOptional({
    name: 'is_remove_cache',
    description: 'When true, bypass and refresh the cached payload for this filter set.',
  })
  @Transform(toBoolean)
  @IsBoolean()
  @IsOptional()
  public readonly isRemoveCache?: boolean;

  @Expose({ name: 'page' })
  @ApiPropertyOptional({ name: 'page', minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  public readonly page: number = 1;

  @Expose({ name: 'limit' })
  @ApiPropertyOptional({ name: 'limit', minimum: 1, maximum: 100, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  public readonly limit: number = 20;

  public get skip(): number {
    return (this.page - 1) * this.limit;
  }
}
