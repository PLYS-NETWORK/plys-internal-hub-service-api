import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProficiencyLevel } from '@plys/libraries/database/enums';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IConsultantSkillPerformanceItem,
  IConsultantSkillPerformanceResponse,
} from './interfaces/consultant-skill-performance.response.interface';

@Exclude()
export class ConsultantSkillPerformanceItemDto implements IConsultantSkillPerformanceItem {
  @Expose()
  @ApiProperty({ name: 'skill_id' })
  public readonly skill_id!: string;
  @Expose()
  @ApiProperty({ name: 'skill_name', example: 'skill_react' })
  public readonly skill_name!: string;
  @Expose()
  @ApiPropertyOptional({ name: 'proficiency_level', enum: ProficiencyLevel, nullable: true })
  public readonly proficiency_level!: ProficiencyLevel | null;
  @Expose()
  @ApiPropertyOptional({ name: 'exam_score', example: '88.5', nullable: true })
  public readonly exam_score!: string | null;
  @Expose()
  @ApiPropertyOptional({
    name: 'last_certified_at',
    nullable: true,
    example: '2026-03-12T09:00:00.000Z',
  })
  public readonly last_certified_at!: string | null;
  @Expose()
  @ApiProperty({ name: 'total_passed_exams', example: 1 })
  public readonly total_passed_exams!: number;
  @Expose()
  @ApiProperty({ name: 'active_projects_count', example: 2 })
  public readonly active_projects_count!: number;
  @Expose()
  @ApiProperty({ name: 'tasks_completed_lifetime', example: 14 })
  public readonly tasks_completed_lifetime!: number;
  @Expose()
  @ApiProperty({ name: 'earnings_from_skill', example: '5200.00' })
  public readonly earnings_from_skill!: string;
}

@Exclude()
export class ConsultantSkillPerformanceResponseDto implements IConsultantSkillPerformanceResponse {
  @Expose()
  @Type(() => ConsultantSkillPerformanceItemDto)
  @ApiProperty({ type: ConsultantSkillPerformanceItemDto, isArray: true })
  public readonly skills!: ConsultantSkillPerformanceItemDto[];

  @Expose()
  @ApiProperty({ name: 'generated_at', example: '2026-05-16T10:12:30.123Z' })
  public readonly generated_at!: string;
}
