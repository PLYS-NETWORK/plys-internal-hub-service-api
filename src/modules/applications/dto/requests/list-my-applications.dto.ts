import { PageOptionsDto } from '@common/dto/page-options.dto';
import { ApplicationStatus } from '@database/enums/application-status.enum';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';

import { IListMyApplicationsRequest } from './interfaces';

/**
 * Query parameters for listing a consultant's own applications.
 *
 * Extends base pagination. Always ordered by `applied_at DESC`.
 * Optionally filter by application status.
 */
export class ListMyApplicationsDto extends PageOptionsDto implements IListMyApplicationsRequest {
  @Expose()
  @ApiPropertyOptional({
    enum: ApplicationStatus,
    description: 'Filter by application status. Omit to return all statuses.',
  })
  @IsEnum(ApplicationStatus)
  @IsOptional()
  public readonly status?: ApplicationStatus;
}
