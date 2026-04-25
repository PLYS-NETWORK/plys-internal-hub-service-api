import { PageOptionsDto } from '@common/dto/page-options.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { PROJECT_KEYWORDS_MAX, PROJECT_KEYWORDS_MIN } from './project.constants';

/**
 * Query parameters for listing a business's own projects.
 *
 * Extends the base pagination options with a full-text keyword filter and
 * project-specific sort columns.
 *
 * Valid `sort_by` values: `title` | `status` | `required_consultants` | `created_at`
 * Defaults to `created_at DESC` when `sort_by` / `order_by` are omitted.
 */
export class ListProjectsDto extends PageOptionsDto {
  /**
   * Case-insensitive substring match against the project `title`.
   * Omit to return all projects without filtering.
   */
  @Expose()
  @ApiPropertyOptional({
    name: 'keywords',
    example: 'e-commerce',
    description: 'Case-insensitive substring filter on project title.',
    minLength: PROJECT_KEYWORDS_MIN,
    maxLength: PROJECT_KEYWORDS_MAX,
  })
  // Trim before validating so callers can't bypass MinLength with whitespace.
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(PROJECT_KEYWORDS_MIN)
  @MaxLength(PROJECT_KEYWORDS_MAX)
  @IsOptional()
  public readonly keywords?: string;
}
