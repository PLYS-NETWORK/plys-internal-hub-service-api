import { PageOptionsDto } from '@common/dto/page-options.dto';
import { BusinessTransactionType } from '@database/enums/business-transaction-type.enum';
import { TransactionStatus } from '@database/enums/transaction-status.enum';
import { ApiPropertyOptional } from '@nestjs/swagger';
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
