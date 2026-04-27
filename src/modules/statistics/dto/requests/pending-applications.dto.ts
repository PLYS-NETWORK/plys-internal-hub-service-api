import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { IPendingApplicationsRequest } from './interfaces/pending-applications.request.interface';

/**
 * Pagination DTO for the pending-applications list. The doc requires the keys
 * `page` and `page_size` (not the project-wide `limit`) and a flat envelope —
 * so this lives outside the shared `PageOptionsDto`.
 */
export class PendingApplicationsDto implements IPendingApplicationsRequest {
  @Expose({ name: 'page' })
  @ApiPropertyOptional({ name: 'page', minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  public readonly page: number = 1;

  @Expose({ name: 'page_size' })
  @ApiPropertyOptional({ name: 'page_size', minimum: 1, maximum: 100, default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  public readonly pageSize: number = 10;

  public get skip(): number {
    return (this.page - 1) * this.pageSize;
  }
}
