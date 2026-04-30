import { PaymentType } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IPublishValidationResponse } from './interfaces/publish-validation.response.interface';

@Exclude()
export class PublishValidationResponseDto implements IPublishValidationResponse {
  @Expose()
  @ApiProperty({ name: 'can_publish', example: true })
  public readonly can_publish!: boolean;

  @Expose()
  @ApiProperty({ name: 'reason_code', example: null, nullable: true })
  public readonly reason_code!: string | null;

  @Expose()
  @ApiProperty({ name: 'account_balance', example: 10000 })
  public readonly account_balance!: number;

  @Expose()
  @ApiProperty({ name: 'project_title', example: 'Build an e-commerce platform' })
  public readonly project_title!: string;

  @Expose()
  @ApiProperty({ name: 'project_amount', example: 5000 })
  public readonly project_amount!: number;

  @Expose()
  @ApiProperty({
    name: 'commission_rate',
    example: 0.25,
    description: 'Commission rate as a decimal. Always 0 for credit businesses.',
  })
  public readonly commission_rate!: number;

  @Expose()
  @ApiProperty({
    name: 'commission_amount',
    example: 1250,
    description: 'Commission amount = project_amount × commission_rate.',
  })
  public readonly commission_amount!: number;

  @Expose()
  @ApiProperty({
    name: 'total_amount',
    example: 6250,
    description: 'Total charged = project_amount + commission_amount.',
  })
  public readonly total_amount!: number;

  @Expose()
  @ApiProperty({ name: 'payment_type', enum: PaymentType, example: PaymentType.PRE_PAID })
  public readonly payment_type!: PaymentType;
}
