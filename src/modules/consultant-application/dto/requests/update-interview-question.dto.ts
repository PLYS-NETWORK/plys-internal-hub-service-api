import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

import { IUpdateInterviewQuestionRequest } from './update-interview-question.request.interface';

export class UpdateInterviewQuestionDto implements IUpdateInterviewQuestionRequest {
  @Expose({ name: 'content' })
  @ApiPropertyOptional({ name: 'content' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  public readonly content?: string;

  @Expose({ name: 'display_order' })
  @ApiPropertyOptional({ name: 'display_order' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  public readonly displayOrder?: number;
}
