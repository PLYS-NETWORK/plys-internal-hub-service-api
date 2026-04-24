import { PageOptionsDto } from '@common/dto/page-options.dto';
import { ApplicationStatus } from '@database/enums';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';

import { IListProjectApplicationsRequest } from './interfaces';

/**
 * Query parameters for listing applications for a business's project.
 *
 * Extends base pagination. Always ordered by `applied_at DESC`.
 * Optionally filter by application status.
 */
export class ListProjectApplicationsDto
  extends PageOptionsDto
  implements IListProjectApplicationsRequest
{
  @Expose()
  @ApiPropertyOptional({
    enum: ApplicationStatus,
    description: 'Filter by application status. Omit to return all statuses.',
  })
  @IsEnum(ApplicationStatus)
  @IsOptional()
  public readonly status?: ApplicationStatus;
}
