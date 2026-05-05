import { TaskCreationMode } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IDraftTaskResponse } from './interfaces/draft-task.response.interface';

@Exclude()
export class DraftTaskResponseDto implements IDraftTaskResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ example: 'WEB-1' })
  public readonly code!: string;

  @Expose()
  @ApiProperty({ example: 'Implement OAuth flow' })
  public readonly title!: string;

  @Expose()
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  public readonly description!: Record<string, unknown> | null;

  @Expose()
  @ApiProperty({ example: '500.00' })
  public readonly price!: string;

  @Expose()
  @ApiProperty({ name: 'platform_fee_amount', example: '50.00' })
  public readonly platform_fee_amount!: string;

  @Expose()
  @ApiProperty({ name: 'consultant_payout', example: '450.00' })
  public readonly consultant_payout!: string;

  @Expose()
  @ApiProperty({ name: 'creation_mode', enum: TaskCreationMode })
  public readonly creation_mode!: TaskCreationMode;

  @Expose()
  @ApiProperty({ name: 'created_at' })
  public readonly created_at!: Date;

  @Expose()
  @ApiProperty({ name: 'updated_at' })
  public readonly updated_at!: Date;
}
