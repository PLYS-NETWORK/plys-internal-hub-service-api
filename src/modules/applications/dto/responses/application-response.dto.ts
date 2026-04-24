import { ApplicationStatus } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import { IApplicationResponse } from './interfaces';
import { MatchedSkillResponseDto } from './matched-skill-response.dto';

@Exclude()
export class ApplicationResponseDto implements IApplicationResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'project_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly project_id!: string;

  @Expose()
  @ApiProperty({ enum: ApplicationStatus, example: ApplicationStatus.PENDING })
  public readonly status!: string;

  @Expose()
  @ApiProperty({ name: 'cover_letter', example: 'I am excited to apply...', nullable: true })
  public readonly cover_letter!: string | null;

  @Expose()
  @ApiProperty({ name: 'matched_skills', type: [MatchedSkillResponseDto] })
  @Type(() => MatchedSkillResponseDto)
  public readonly matched_skills!: MatchedSkillResponseDto[];

  @Expose()
  @ApiProperty({ name: 'applied_at' })
  public readonly applied_at!: string;
}
