import { ApiPropertyOptional } from '@nestjs/swagger';
import { PageOptionsDto } from '@plys/libraries/common-nest/dto/page-options.dto';
import { BillingPeriodStatus } from '@plys/libraries/database/enums';
import { Expose } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class ListBillsDto extends PageOptionsDto {
  @Expose()
  @ApiPropertyOptional({ enum: BillingPeriodStatus })
  @IsEnum(BillingPeriodStatus)
  @IsOptional()
  public readonly status?: BillingPeriodStatus;

  @Expose({ name: 'business_id' })
  @ApiPropertyOptional({ name: 'business_id', description: 'Filter by business UUID' })
  @IsUUID()
  @IsOptional()
  public readonly businessId?: string;
}
