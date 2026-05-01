import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IProjectSettingsInterviewQuestion,
  IProjectSettingsRequiredSkill,
  IProjectSettingsResponse,
} from './interfaces/project-settings.response.interface';

@Exclude()
export class ProjectSettingsRequiredSkillDto implements IProjectSettingsRequiredSkill {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ example: 'React', description: 'Translated for the active locale.' })
  public readonly name!: string;
}

@Exclude()
export class ProjectSettingsInterviewQuestionDto implements IProjectSettingsInterviewQuestion {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'question_text' })
  public readonly question_text!: string;

  @Expose()
  @ApiProperty({ name: 'display_order', example: 1 })
  public readonly display_order!: number;

  @Expose()
  @ApiProperty({ name: 'is_required', example: true })
  public readonly is_required!: boolean;
}

@Exclude()
export class ProjectSettingsResponseDto implements IProjectSettingsResponse {
  @Expose()
  @ApiProperty({ example: 'AI customer support automation' })
  public readonly title!: string;

  @Expose()
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  public readonly introduction!: Record<string, unknown> | null;

  @Expose()
  @Type(() => ProjectSettingsRequiredSkillDto)
  @ApiProperty({
    name: 'required_skills',
    type: () => ProjectSettingsRequiredSkillDto,
    isArray: true,
  })
  public readonly required_skills!: ProjectSettingsRequiredSkillDto[];

  @Expose()
  @ApiProperty({ name: 'max_consultants', example: 1 })
  public readonly max_consultants!: number;

  @Expose()
  @Type(() => ProjectSettingsInterviewQuestionDto)
  @ApiProperty({
    name: 'interview_questions',
    type: () => ProjectSettingsInterviewQuestionDto,
    isArray: true,
    description: 'Active questions only — soft-deleted ones are excluded.',
  })
  public readonly interview_questions!: ProjectSettingsInterviewQuestionDto[];
}
