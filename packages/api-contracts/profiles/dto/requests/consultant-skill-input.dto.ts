import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsUUID } from 'class-validator';

import { IConsultantSkillInputRequest } from './interfaces/consultant-skill-input.request.interface';

// Post-refactor: consultants no longer self-report proficiency or years.
// These are assigned by the per-skill exam pipeline (see ConsultantSkillExam).
export class ConsultantSkillInputDto implements IConsultantSkillInputRequest {
  @Expose()
  @ApiProperty({ name: 'skill_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  public readonly skill_id!: string;
}
