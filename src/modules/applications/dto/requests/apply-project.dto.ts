import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

import { IApplyProjectRequest } from './interfaces';
import { InterviewAnswerInputDto } from './interview-answer-input.dto';

export class ApplyProjectDto implements IApplyProjectRequest {
  @Expose({ name: 'project_id' })
  @ApiProperty({
    name: 'project_id',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  public readonly projectId!: string;

  @Expose({ name: 'cover_letter' })
  @ApiPropertyOptional({
    name: 'cover_letter',
    description: 'Cover letter (required when the project has no interview questions).',
    example: 'I am excited to apply for this project because...',
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  public readonly coverLetter?: string;

  @Expose()
  @ApiPropertyOptional({
    name: 'answers',
    type: [InterviewAnswerInputDto],
    description: 'Interview question answers (required when the project has interview questions).',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterviewAnswerInputDto)
  @IsOptional()
  public readonly answers?: InterviewAnswerInputDto[];
}
