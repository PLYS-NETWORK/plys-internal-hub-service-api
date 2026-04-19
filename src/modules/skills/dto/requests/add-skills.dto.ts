import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

import { IAddSkillItemRequest, IAddSkillsRequest } from './add-skills.request.interface';

export class AddSkillItemDto implements IAddSkillItemRequest {
  @ApiProperty({
    example: 'skill_react',
    description: 'i18n key — must match ^skill_[a-z0-9_]+$',
  })
  @IsString()
  @Matches(/^skill_[a-z0-9_]+$/, {
    message: 'name must match pattern ^skill_[a-z0-9_]+$',
  })
  public readonly name!: string;

  @ApiPropertyOptional({
    example: 'category_frontend',
    description: 'i18n category key — must match ^category_[a-z0-9_]+$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^category_[a-z0-9_]+$/, {
    message: 'category must match pattern ^category_[a-z0-9_]+$',
  })
  public readonly category?: string;
}

export class AddSkillsDto implements IAddSkillsRequest {
  @ApiProperty({
    type: [AddSkillItemDto],
    description: 'List of skills to add',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AddSkillItemDto)
  public readonly skills!: AddSkillItemDto[];
}
