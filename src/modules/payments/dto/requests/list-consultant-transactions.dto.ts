import { PageOptionsDto } from '@common/dto/page-options.dto';
import { ConsultantTransactionType, TransactionStatus } from '@database/enums';
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
