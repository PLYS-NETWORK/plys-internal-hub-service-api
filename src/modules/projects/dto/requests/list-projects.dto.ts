import { PageOptionsDto } from '@common/dto/page-options.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

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
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  public readonly keywords?: string;
}
