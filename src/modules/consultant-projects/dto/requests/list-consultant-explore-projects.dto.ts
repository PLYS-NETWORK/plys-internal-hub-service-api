import { PageOptionsDto } from '@common/dto/page-options.dto';
import { ProjectStatus } from '@database/enums';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import {
  ConsultantExploreStatusFilter,
  IListConsultantExploreProjectsRequest,
} from './interfaces/list-consultant-explore-projects.request.interface';

// Whitelisted statuses for the consultant discovery filter. The repository
// hard-pins the status set to this same pair regardless of the query param,
// so even a crafted request can never surface DRAFT / CANCELLED / DONE rows.
const STATUS_FILTER_VALUES: ConsultantExploreStatusFilter[] = [
  ProjectStatus.PUBLISHED,
  ProjectStatus.IN_PROGRESS,
];

export class ListConsultantExploreProjectsDto
  extends PageOptionsDto
  implements IListConsultantExploreProjectsRequest
{
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
      'Narrow the list to a single status. Only `published` or `in_progress` are accepted; ' +
      'any other value is rejected with 422. Omit the param to return both statuses.',
    enum: STATUS_FILTER_VALUES,
    example: ProjectStatus.PUBLISHED,
  })
  @IsOptional()
  @IsIn(STATUS_FILTER_VALUES)
  public readonly status?: ConsultantExploreStatusFilter;
}
