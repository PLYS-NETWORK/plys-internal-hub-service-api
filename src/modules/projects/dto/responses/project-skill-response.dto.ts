import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IProjectSkillResponse } from './interfaces/project-skill.response.interface';

@Exclude()
export class ProjectSkillResponseDto implements IProjectSkillResponse {
  @Expose()
  @ApiProperty({ name: 'skill_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly skill_id!: string;

  @Expose()
  @ApiProperty({
    name: 'skill_name',
    example: 'React',
    description: 'Translated skill label for the request locale',
  })
  public readonly skill_name!: string;
}
