import { ApiPropertyOptional } from '@nestjs/swagger';
import { MaxJsonSize } from '@plys/libraries/common-nest/validators/max-json-size.validator';
import { Expose } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

import { IUpdateProjectSettingsRequest } from './interfaces/update-project-settings.request.interface';

const MAX_SKILLS = 50;
const INTRODUCTION_MAX_BYTES = 50 * 1024;

export class UpdateProjectSettingsDto implements IUpdateProjectSettingsRequest {
  @Expose({ name: 'title' })
  @ApiPropertyOptional({ name: 'title', minLength: 3, maxLength: 300 })
  @IsOptional()
  @IsString()
  @Length(3, 300)
  public readonly title?: string;

  @Expose({ name: 'introduction' })
  @ApiPropertyOptional({
    name: 'introduction',
    type: 'object',
    additionalProperties: true,
    description: 'Tiptap doc, opaque to the BE. Capped at 50 KB.',
  })
  @IsOptional()
  @IsObject()
  @MaxJsonSize(INTRODUCTION_MAX_BYTES)
  public readonly introduction?: Record<string, unknown> | null;

  @Expose({ name: 'required_skills' })
  @ApiPropertyOptional({
    name: 'required_skills',
    type: [String],
    description: 'Replaces the full set when present.',
    maxItems: MAX_SKILLS,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SKILLS)
  @IsUUID('4', { each: true })
  public readonly requiredSkills?: string[];

  @Expose({ name: 'max_consultants' })
  @ApiPropertyOptional({ name: 'max_consultants', minimum: 0, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  public readonly maxConsultants?: number;
}
