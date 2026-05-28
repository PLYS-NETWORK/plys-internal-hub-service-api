import { ApiPropertyOptional } from '@nestjs/swagger';
import { PageOptionsDto } from '@plys/libraries/common-nest/dto/page-options.dto';
import { ProjectStatus } from '@plys/libraries/database/enums';
import { Expose, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import {
  ExploreProjectStatusFilter,
  IListExploreProjectsRequest,
} from './list-explore-projects.request.interface';

// Whitelisted statuses for the public filter. The repository hard-pins the
// status set to this same pair regardless of the query param, so even a
// crafted request can never surface DRAFT / CANCELLED / DONE projects.
const EXPLORE_STATUS_FILTER_VALUES: ExploreProjectStatusFilter[] = [
  ProjectStatus.PUBLISHED,
  ProjectStatus.IN_PROGRESS,
];

export class ListExploreProjectsDto extends PageOptionsDto implements IListExploreProjectsRequest {
  @Expose({ name: 'skill_ids' })
  @ApiPropertyOptional({
    name: 'skill_ids',
    description:
      'Comma-separated UUIDs. A project matches if it requires ANY of the listed skills.',
    example: 'b0b1f9d0-1111-4222-8333-444455556666,c1c2e8a0-aaaa-4bbb-8ccc-ddddeeeeefff',
  })
  @IsOptional()
  // Query strings always arrive as strings — split on `,` before validating
  // each entry as a UUID. Whitespace and empty fragments are dropped so the
  // client can send `skill_ids=a,,b` without a 400.
  @Transform(({ value }: { value: unknown }) => {
    if (Array.isArray(value)) {
      return (value as unknown[])
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter((s) => s.length > 0);
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    return value;
  })
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  public readonly skillIds?: string[];

  @Expose({ name: 'title' })
  @ApiPropertyOptional({
    name: 'title',
    description: 'Case-insensitive substring match on the project title.',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public readonly title?: string;

  @Expose({ name: 'status' })
  @ApiPropertyOptional({
    name: 'status',
    description:
      'Narrow the list to a single status. Only `published` or `in_progress` are accepted; any other value is rejected with 422. Omit the param to return both statuses.',
    enum: EXPLORE_STATUS_FILTER_VALUES,
    example: ProjectStatus.PUBLISHED,
  })
  @IsOptional()
  @IsIn(EXPLORE_STATUS_FILTER_VALUES)
  public readonly status?: ExploreProjectStatusFilter;
}
