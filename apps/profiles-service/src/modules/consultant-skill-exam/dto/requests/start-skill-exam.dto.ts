import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsUUID } from 'class-validator';

import { IStartSkillExamRequest } from './interfaces/start-skill-exam.request.interface';

export class StartSkillExamDto implements IStartSkillExamRequest {
  @Expose()
  @ApiProperty({ name: 'skill_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  public readonly skill_id!: string;
}
