import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  IAdminManualScoreRequest,
  IAnswerScoreEntry,
} from './admin-manual-score.request.interface';

export class AnswerScoreEntryDto implements IAnswerScoreEntry {
  @Expose({ name: 'application_question_id' })
  @ApiProperty({ name: 'application_question_id', example: 'uuid-here' })
  @IsUUID('4')
  public readonly applicationQuestionId!: string;

  @Expose({ name: 'score' })
  @ApiProperty({ name: 'score', example: 85, minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  public readonly score!: number;

  @Expose({ name: 'notes' })
  @ApiPropertyOptional({ name: 'notes', example: 'Strong communication demonstrated.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  public readonly notes?: string;
}

export class AdminManualScoreDto implements IAdminManualScoreRequest {
  @Expose({ name: 'scores' })
  @ApiProperty({ name: 'scores', type: [AnswerScoreEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerScoreEntryDto)
  public readonly scores!: AnswerScoreEntryDto[];

  @Expose({ name: 'admin_eval_score' })
  @ApiProperty({ name: 'admin_eval_score', example: 78, minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  public readonly adminEvalScore!: number;
}
