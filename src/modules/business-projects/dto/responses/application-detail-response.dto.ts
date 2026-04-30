import { ApplicationStatus, ProficiencyLevel } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IApplicationConsultantSkill,
  IApplicationDetailConsultant,
  IApplicationDetailResponse,
  IApplicationInterviewAnswer,
} from './interfaces/application-detail.response.interface';

@Exclude()
export class ApplicationConsultantSkillDto implements IApplicationConsultantSkill {
  @Expose() @ApiProperty() public readonly id!: string;
  @Expose() @ApiProperty() public readonly name!: string;
  @Expose()
  @ApiProperty({ name: 'proficiency_level', enum: ProficiencyLevel })
  public readonly proficiency_level!: ProficiencyLevel;
  @Expose()
  @ApiProperty({ name: 'years_with_skill', nullable: true })
  public readonly years_with_skill!: number | null;
}

@Exclude()
export class ApplicationDetailConsultantDto implements IApplicationDetailConsultant {
  @Expose() @ApiProperty() public readonly id!: string;
  @Expose() @ApiProperty({ name: 'full_name' }) public readonly full_name!: string;
  @Expose()
  @ApiProperty({ name: 'avatar_url', nullable: true })
  public readonly avatar_url!: string | null;

  @Expose()
  @Type(() => ApplicationConsultantSkillDto)
  @ApiProperty({ type: () => ApplicationConsultantSkillDto, isArray: true })
  public readonly skills!: ApplicationConsultantSkillDto[];
}

@Exclude()
export class ApplicationInterviewAnswerDto implements IApplicationInterviewAnswer {
  @Expose() @ApiProperty({ name: 'question_id' }) public readonly question_id!: string;
  @Expose()
  @ApiProperty({ name: 'question_text_snapshot' })
  public readonly question_text_snapshot!: string;
  @Expose()
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  public readonly answer!: Record<string, unknown> | null;
  @Expose()
  @ApiProperty({ name: 'is_question_deleted' })
  public readonly is_question_deleted!: boolean;
}

@Exclude()
export class ApplicationDetailResponseDto implements IApplicationDetailResponse {
  @Expose() @ApiProperty() public readonly id!: string;
  @Expose() @ApiProperty({ enum: ApplicationStatus }) public readonly status!: ApplicationStatus;
  @Expose()
  @ApiProperty({ name: 'cover_letter', nullable: true })
  public readonly cover_letter!: string | null;
  @Expose() @ApiProperty({ name: 'applied_at' }) public readonly applied_at!: Date;
  @Expose()
  @ApiProperty({ name: 'reviewed_at', nullable: true })
  public readonly reviewed_at!: Date | null;
  @Expose()
  @ApiProperty({ name: 'rejection_reason', nullable: true })
  public readonly rejection_reason!: string | null;
  @Expose()
  @ApiProperty({ name: 'matching_rate', example: 75 })
  public readonly matching_rate!: number;

  @Expose()
  @Type(() => ApplicationDetailConsultantDto)
  @ApiProperty({ type: () => ApplicationDetailConsultantDto })
  public readonly consultant!: ApplicationDetailConsultantDto;

  @Expose()
  @Type(() => ApplicationInterviewAnswerDto)
  @ApiProperty({
    name: 'interview_answers',
    type: () => ApplicationInterviewAnswerDto,
    isArray: true,
  })
  public readonly interview_answers!: ApplicationInterviewAnswerDto[];
}
