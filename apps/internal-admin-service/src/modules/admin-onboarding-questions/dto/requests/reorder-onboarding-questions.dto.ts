import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

import { IReorderOnboardingQuestionsRequest } from './interfaces/reorder-onboarding-questions.request.interface';

export class ReorderOnboardingQuestionsDto implements IReorderOnboardingQuestionsRequest {
  @Expose({ name: 'ordered_ids' })
  @ApiProperty({
    name: 'ordered_ids',
    type: [String],
    description:
      'Full ordered list of active question UUIDs. Must contain every active question exactly once. Inactive / soft-deleted ids are rejected.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  public readonly orderedIds!: string[];
}
