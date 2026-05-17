import { PageOptionsDto } from '@common/dto/page-options.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { IListConsultantJoinedProjectsRequest } from './interfaces/list-consultant-joined-projects.request.interface';

export class ListConsultantJoinedProjectsDto
  extends PageOptionsDto
  implements IListConsultantJoinedProjectsRequest
{
  @Expose({ name: 'keyword' })
  @ApiPropertyOptional({
    name: 'keyword',
    description: 'Case-insensitive substring match on project title or code.',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public readonly keyword?: string;
}
