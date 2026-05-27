import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IConsultantSkillResponse } from './interfaces/consultant-skill.response.interface';

@Exclude()
export class ConsultantSkillResponseDto implements IConsultantSkillResponse {
  @Expose()
  @ApiProperty({ name: 'skill_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly skill_id!: string;

  @Expose()
  @ApiPropertyOptional({
    name: 'proficiency_level',
    nullable: true,
    example: 'advanced',
    description: 'System-assigned from latest passed skill exam; null if no passed exam.',
  })
  public readonly proficiency_level!: string | null;

  @Expose()
  @ApiPropertyOptional({
    nullable: true,
    example: '92.50',
    description: '0–100 % score from the latest passed skill exam.',
  })
  public readonly rating!: string | null;
}
