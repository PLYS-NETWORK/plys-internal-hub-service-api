import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IMatchedSkillResponse } from './interfaces';

@Exclude()
export class MatchedSkillResponseDto implements IMatchedSkillResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ example: 'skill_react' })
  public readonly name!: string;
}
