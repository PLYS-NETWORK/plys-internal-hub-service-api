import { TaskReviewDecision } from '@database/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { ISubmitVoteRequest } from './interfaces/submit-vote.request.interface';

const VOTABLE: ReadonlyArray<TaskReviewDecision.PASS | TaskReviewDecision.FAIL> = [
  TaskReviewDecision.PASS,
  TaskReviewDecision.FAIL,
];

export class SubmitVoteDto implements ISubmitVoteRequest {
  @Expose({ name: 'decision' })
  @ApiProperty({
    name: 'decision',
    enum: VOTABLE,
    example: TaskReviewDecision.PASS,
    description: 'Reviewer verdict. Only PASS or FAIL are valid.',
  })
  @IsIn(VOTABLE as ReadonlyArray<string>)
  public readonly decision!: TaskReviewDecision.PASS | TaskReviewDecision.FAIL;

  @Expose({ name: 'feedback' })
  @ApiPropertyOptional({
    name: 'feedback',
    description: 'Plain-text rationale shown to the consultant on REVISION_REQUESTED.',
    maxLength: 2_000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  public readonly feedback?: string;
}
