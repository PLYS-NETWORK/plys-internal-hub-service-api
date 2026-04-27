import { ActivityType } from '@modules/unit-of-work/repositories';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { ArrayUnique, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { IActivityFeedRequest } from './interfaces/activity-feed.request.interface';

const VALID_TYPES: readonly ActivityType[] = ['task', 'application', 'member'];

/**
 * Query params for `GET /projects-business/:id/overview/activity`.
 * `types` accepts a comma-separated list (`?types=task,application`) which
 * is split + de-duped at transform time. Unknown tokens get filtered so the
 * `@IsIn` rule rejects them with a validation error.
 */
export class ActivityFeedDto implements IActivityFeedRequest {
  @Expose({ name: 'page' })
  @ApiPropertyOptional({ name: 'page', minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  public readonly page: number = 1;

  @Expose({ name: 'page_size' })
  @ApiPropertyOptional({ name: 'page_size', minimum: 1, maximum: 50, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  public readonly pageSize: number = 20;

  @Expose({ name: 'types' })
  @ApiPropertyOptional({
    name: 'types',
    example: 'task,application',
    description: 'Comma-separated category filter: any of `task`, `application`, `member`.',
  })
  @Transform(({ value }: { value: unknown }): ActivityType[] | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    const raw = Array.isArray(value) ? value : String(value).split(',');
    const trimmed = raw.map((v) => String(v).trim()).filter(Boolean);
    return trimmed.length > 0 ? (trimmed as ActivityType[]) : undefined;
  })
  @IsIn(VALID_TYPES, { each: true })
  @ArrayUnique()
  @IsOptional()
  public readonly types?: ActivityType[];

  public get skip(): number {
    return (this.page - 1) * this.pageSize;
  }
}
