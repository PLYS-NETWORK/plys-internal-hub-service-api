import { PaymentType } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IPayTasksResponse } from './interfaces/pay-tasks.response.interface';

@Exclude()
export class PayTasksResponseDto implements IPayTasksResponse {
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
  @ApiProperty({ name: 'transaction_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly transaction_id!: string;
}
