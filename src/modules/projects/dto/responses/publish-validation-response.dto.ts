import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IPublishValidationResponse } from './interfaces/publish-validation.response.interface';

@Exclude()
export class PublishValidationResponseDto implements IPublishValidationResponse {
  @Expose()
  @ApiProperty({ example: true })
  public readonly can_publish!: boolean;

  @Expose()
  @ApiProperty({ example: null, nullable: true })
  public readonly reason_code!: string | null;

  @Expose()
  @ApiProperty({ example: 10000 })
  public readonly account_balance!: number;

  @Expose()
  @ApiProperty({ example: 'Build an e-commerce platform' })
  public readonly project_title!: string;

  @Expose()
  @ApiProperty({ example: 5000 })
  public readonly project_amount!: number;

  @Expose()
  @ApiProperty({ example: 'pre-paid', enum: ['credit', 'pre-paid'] })
  public readonly payment_type!: 'credit' | 'pre-paid';
}
