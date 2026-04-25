import { ProficiencyLevel } from '@database/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

import { IConsultantSkillInputRequest } from './interfaces/consultant-skill-input.request.interface';

export class ConsultantSkillInputDto implements IConsultantSkillInputRequest {
  @Expose()
  @ApiProperty({ name: 'skill_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  public readonly skill_id!: string;

  @Expose()
  @ApiPropertyOptional({
    name: 'proficiency_level',
    enum: ProficiencyLevel,
    example: ProficiencyLevel.INTERMEDIATE,
  })
  @IsEnum(ProficiencyLevel)
  @IsOptional()
  public readonly proficiency_level?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'years_with_skill', example: 3 })
  @IsInt()
  @Min(0)
  @IsOptional()
  public readonly years_with_skill?: number;
}
