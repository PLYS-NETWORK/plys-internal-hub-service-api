import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class TriggerSettlementDto {
  @Expose()
  @ApiProperty({ description: 'Full year (e.g. 2026)', minimum: 2024, example: 2026 })
  @IsInt()
  @Min(2024)
  public readonly year!: number;

  @Expose()
  @ApiProperty({
    description: '1-indexed month (1 = January … 12 = December)',
    minimum: 1,
    maximum: 12,
    example: 4,
  })
  @IsInt()
  @Min(1)
  @Max(12)
  public readonly month!: number;

  @Expose({ name: 'business_id' })
  @ApiPropertyOptional({
    name: 'business_id',
    description: 'Settle only this business; if omitted, settles all businesses for the period',
  })
  @IsUUID()
  @IsOptional()
  public readonly businessId?: string;
}
