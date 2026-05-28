import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsObject, IsOptional, IsString, Length, Matches } from 'class-validator';

import { ICreateProjectRequest } from './interfaces/create-project.request.interface';

export class CreateProjectDto implements ICreateProjectRequest {
  @Expose({ name: 'code' })
  @ApiProperty({
    name: 'code',
    example: 'WEB',
    description:
      'Human-readable project identifier, unique within the business profile. Uppercase A-Z and 0-9, 2 to 8 characters. Used as the prefix for task codes (e.g. WEB-1).',
    minLength: 2,
    maxLength: 8,
    pattern: '^[A-Z0-9]{2,8}$',
  })
  @IsString()
  @Matches(/^[A-Z0-9]{2,8}$/, {
    message: 'code must be 2-8 uppercase letters or digits',
  })
  public readonly code!: string;

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
