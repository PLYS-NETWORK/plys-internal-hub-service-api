import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { IUploadFileRequest } from './interfaces';

export class UploadFileDto implements IUploadFileRequest {
  @Expose()
  @ApiPropertyOptional({
    description: 'Optional caller-supplied tag, e.g. `avatar` or `project_attachment`.',
    maxLength: 64,
  })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  public readonly purpose?: string;
}
