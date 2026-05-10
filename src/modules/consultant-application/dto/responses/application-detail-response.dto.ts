import { ApplicationStatus, QuestionType } from '@database/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IAnswerDetailResponse,
  IApplicationDetailResponse,
} from './application-detail.response.interface';

@Exclude()
export class AnswerDetailResponseDto implements IAnswerDetailResponse {
  @Expose()
  @ApiProperty()
  public readonly application_question_id!: string;

  @Expose()
  @ApiProperty()
  public readonly question_order!: number;

  @Expose()
  @ApiProperty({ enum: QuestionType })
  public readonly type!: QuestionType;

  @Expose()
  @ApiProperty()
  public readonly content!: string;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  public readonly answer_text!: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  public readonly copyleaks_ai_score!: number | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  public readonly ai_eval_score!: number | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  public readonly ai_feedback!: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  public readonly admin_score!: number | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  public readonly admin_notes!: string | null;
}

@Exclude()
export class ApplicationDetailResponseDto implements IApplicationDetailResponse {
  @Expose()
  @ApiProperty()
  public readonly id!: string;

  @Expose()
  @ApiProperty({ enum: ApplicationStatus })
  public readonly status!: ApplicationStatus;

  @Expose()
  @ApiProperty()
  public readonly consultant_email!: string;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  public readonly profile_submitted_at!: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  public readonly interview_submitted_at!: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  public readonly copyleaks_score!: number | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  public readonly ai_eval_score!: number | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  public readonly admin_eval_score!: number | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  public readonly final_score!: number | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  public readonly blocked_until!: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  public readonly rejection_reason!: string | null;

  @Expose()
  @Type(() => AnswerDetailResponseDto)
  @ApiProperty({ type: [AnswerDetailResponseDto] })
  public readonly answers!: AnswerDetailResponseDto[];

  @Expose()
  @ApiProperty()
  public readonly created_at!: string;
}
