import { PaymentType } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IAddToBoardValidationResponse } from './interfaces/add-to-board-validation.response.interface';

@Exclude()
export class AddToBoardValidationResponseDto implements IAddToBoardValidationResponse {
  @Expose()
  @ApiProperty({ name: 'is_valid', example: true })
  public readonly is_valid!: boolean;

  @Expose()
  @ApiProperty({ name: 'reason_code', nullable: true })
  public readonly reason_code!: string | null;

  @Expose()
  @ApiProperty({ name: 'moved_task_ids', type: [String] })
  public readonly moved_task_ids!: string[];

  @Expose()
  @ApiProperty({ name: 'project_amount', example: '5000.00' })
  public readonly project_amount!: string;

  @Expose()
  @ApiProperty({ name: 'commission_rate', example: '0.2500' })
  public readonly commission_rate!: string;

  @Expose()
  @ApiProperty({ name: 'commission_amount', example: '1250.00' })
  public readonly commission_amount!: string;

  @Expose()
  @ApiProperty({ name: 'total_amount', example: '6250.00' })
  public readonly total_amount!: string;

  @Expose()
  @ApiProperty({ name: 'payment_type', enum: PaymentType })
  public readonly payment_type!: PaymentType;

  @Expose()
  @ApiProperty({ name: 'account_balance', example: '12000.00' })
  public readonly account_balance!: string;
}
