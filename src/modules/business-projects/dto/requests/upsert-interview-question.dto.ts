import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

import { IUpsertInterviewQuestionRequest } from './interfaces/upsert-interview-question.request.interface';

export class UpsertInterviewQuestionDto implements IUpsertInterviewQuestionRequest {
  @Expose({ name: 'question_text' })
  @ApiProperty({ name: 'question_text', minLength: 5, maxLength: 500 })
  @IsString()
  @Length(5, 500)
  public readonly questionText!: string;

  @Expose({ name: 'display_order' })
  @ApiPropertyOptional({ name: 'display_order', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  public readonly displayOrder?: number;

  @Expose({ name: 'is_required' })
  @ApiPropertyOptional({ name: 'is_required', default: true })
  @IsOptional()
  @IsBoolean()
  public readonly isRequired?: boolean;
}

export class UpdateInterviewQuestionDto implements IUpsertInterviewQuestionRequest {
  @Expose({ name: 'question_text' })
  @ApiPropertyOptional({ name: 'question_text', minLength: 5, maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(5, 500)
  public readonly questionText?: string;

  @Expose({ name: 'display_order' })
  @ApiPropertyOptional({ name: 'display_order', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  public readonly displayOrder?: number;

  @Expose({ name: 'is_required' })
  @ApiPropertyOptional({ name: 'is_required' })
  @IsOptional()
  @IsBoolean()
  public readonly isRequired?: boolean;
}
