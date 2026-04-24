import { PageOptionsDto } from '@common/dto/page-options.dto';
import { ConsultantTransactionType } from '@database/enums/consultant-transaction-type.enum';
import { TransactionStatus } from '@database/enums/transaction-status.enum';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export class ListConsultantTransactionsDto extends PageOptionsDto {
  @ApiPropertyOptional({ enum: ConsultantTransactionType })
  @IsEnum(ConsultantTransactionType)
  @IsOptional()
  public readonly type?: ConsultantTransactionType;

  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsEnum(TransactionStatus)
  @IsOptional()
  public readonly status?: TransactionStatus;
}
