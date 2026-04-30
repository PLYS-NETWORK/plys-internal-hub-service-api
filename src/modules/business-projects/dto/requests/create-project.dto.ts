import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsObject, IsOptional, IsString, Length } from 'class-validator';

import { ICreateProjectRequest } from './interfaces/create-project.request.interface';

export class CreateProjectDto implements ICreateProjectRequest {
  @Expose({ name: 'title' })
  @ApiProperty({ name: 'title', example: 'AI-powered customer support automation', maxLength: 300 })
  @IsString()
  @Length(3, 300)
  public readonly title!: string;

  @Expose({ name: 'introduction' })
  @ApiPropertyOptional({
    name: 'introduction',
    description: 'Rich-text TipTap/ProseMirror JSON document',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  public readonly introduction?: Record<string, unknown> | null;
}
