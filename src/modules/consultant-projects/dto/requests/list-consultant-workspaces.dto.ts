import { PageOptionsDto } from '@common/dto/page-options.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { IListConsultantWorkspacesRequest } from './interfaces/list-consultant-workspaces.request.interface';

export class ListConsultantWorkspacesDto
  extends PageOptionsDto
  implements IListConsultantWorkspacesRequest
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
