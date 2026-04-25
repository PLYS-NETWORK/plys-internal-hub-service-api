import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IConsultantSkillResponse } from './interfaces/consultant-skill.response.interface';

@Exclude()
export class ConsultantSkillResponseDto implements IConsultantSkillResponse {
  @Expose()
  @ApiProperty({ name: 'skill_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly skill_id!: string;

  @Expose()
  @ApiProperty({ name: 'proficiency_level', example: 'intermediate' })
  public readonly proficiency_level!: string;

  @Expose()
  @ApiProperty({ name: 'years_with_skill', nullable: true, example: 3 })
  public readonly years_with_skill!: number | null;
}
