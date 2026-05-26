import { ApiPropertyOptional } from '@nestjs/swagger';
import { PageOptionsDto } from '@plys/libraries/common-nest/dto/page-options.dto';
import { ConsultantTransactionType, TransactionStatus } from '@plys/libraries/database/enums';
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
