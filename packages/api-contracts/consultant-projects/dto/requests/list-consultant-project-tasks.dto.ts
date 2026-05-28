import { ApiPropertyOptional } from '@nestjs/swagger';
import { PageOptionsDto } from '@plys/libraries/common-nest/dto/page-options.dto';
import { Expose } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { IListConsultantProjectTasksRequest } from './interfaces/list-consultant-project-tasks.request.interface';

export class ListConsultantProjectTasksDto
  extends PageOptionsDto
  implements IListConsultantProjectTasksRequest
{
  @Expose({ name: 'keyword' })
  @ApiPropertyOptional({
    name: 'keyword',
    description: 'Case-insensitive substring match on task title or code.',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public readonly keyword?: string;
}
