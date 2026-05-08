import { SanitizeText } from '@common/transformers/sanitize-text.transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsIn, IsString, Length } from 'class-validator';

import { DecisionSource, ILogDecisionRequest } from './interfaces/log-decision.request.interface';

const DECISION_SOURCES: DecisionSource[] = ['planning', 'refine', 'extend'];

export class LogDecisionDto implements ILogDecisionRequest {
  @Expose({ name: 'decision' })
  @SanitizeText({ fieldLabel: 'decision' })
  @ApiProperty({ name: 'decision', example: 'Mobile excluded from v1' })
  @IsString()
  @Length(1, 500)
  public readonly decision!: string;

  @Expose({ name: 'rationale' })
  @SanitizeText({ fieldLabel: 'rationale' })
  @ApiProperty({
    name: 'rationale',
    example: 'Engineering capacity is limited; web rollout is the priority. Revisit in Q3.',
  })
  @IsString()
  @Length(1, 2000)
  public readonly rationale!: string;

  @Expose({ name: 'source' })
  @ApiProperty({
    name: 'source',
    enum: DECISION_SOURCES,
    description: 'Which planning episode produced this decision.',
  })
  @IsIn(DECISION_SOURCES)
  public readonly source!: DecisionSource;
}
