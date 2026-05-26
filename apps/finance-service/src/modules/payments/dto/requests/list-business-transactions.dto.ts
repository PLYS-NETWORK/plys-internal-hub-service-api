import { ApiPropertyOptional } from '@nestjs/swagger';
import { PageOptionsDto } from '@plys/libraries/common-nest/dto/page-options.dto';
import { BusinessTransactionType, TransactionStatus } from '@plys/libraries/database/enums';
import { IsEnum, IsOptional } from 'class-validator';

export class ListBusinessTransactionsDto extends PageOptionsDto {
  @ApiPropertyOptional({ enum: BusinessTransactionType })
  @IsEnum(BusinessTransactionType)
  @IsOptional()
  public readonly type?: BusinessTransactionType;

  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsEnum(TransactionStatus)
  @IsOptional()
  public readonly status?: TransactionStatus;
}
