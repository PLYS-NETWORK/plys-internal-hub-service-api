import { SkillExamStatus } from '@database/enums';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import { IListSkillExamsRequest } from './interfaces/list-skill-exams.request.interface';

export class ListSkillExamsDto implements IListSkillExamsRequest {
  @Expose()
  @ApiPropertyOptional({
    enum: SkillExamStatus,
    description: 'Filter by underlying skill-exam status. When omitted, returns every status.',
  })
  @IsOptional()
  @IsEnum(SkillExamStatus)
  public readonly status?: string;

  @Expose({ name: 'consultant_id' })
  @ApiPropertyOptional({
    name: 'consultant_id',
    description: 'Filter to a single consultant (ConsultantProfile.id, NOT user_id).',
  })
  @IsOptional()
  @IsUUID('4')
  public readonly consultantId?: string;

  @Expose({ name: 'skill_id' })
  @ApiPropertyOptional({ name: 'skill_id', description: 'Filter to a single skill.' })
  @IsOptional()
  @IsUUID('4')
  public readonly skillId?: string;

  @Expose()
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public readonly page?: number;

  @Expose()
  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public readonly take?: number;
}
