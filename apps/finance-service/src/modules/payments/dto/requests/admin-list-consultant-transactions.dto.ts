import { ApiPropertyOptional } from '@nestjs/swagger';
import { PageOptionsDto } from '@plys/libraries/common-nest/dto/page-options.dto';
import { ConsultantTransactionType, TransactionStatus } from '@plys/libraries/database/enums';
import { Expose, Type } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

import { IAdminListConsultantTransactionsRequest } from './interfaces/admin-list-consultant-transactions.request.interface';

export class AdminListConsultantTransactionsDto
  extends PageOptionsDto
  implements IAdminListConsultantTransactionsRequest
{
  @ApiPropertyOptional({ enum: ConsultantTransactionType })
  @IsEnum(ConsultantTransactionType)
  @IsOptional()
  public readonly type?: ConsultantTransactionType;

  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsEnum(TransactionStatus)
  @IsOptional()
  public readonly status?: TransactionStatus;

  @Expose({ name: 'consultant_id' })
  @ApiPropertyOptional({ name: 'consultant_id', format: 'uuid' })
  @IsUUID()
  @IsOptional()
  public readonly consultantId?: string;

  @Expose({ name: 'created_from' })
  @ApiPropertyOptional({ name: 'created_from', example: '2026-01-01T00:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  @Type(() => Date)
  public readonly createdFrom?: Date;

  @Expose({ name: 'created_to' })
  @ApiPropertyOptional({ name: 'created_to', example: '2026-06-01T00:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  @Type(() => Date)
  public readonly createdTo?: Date;
}
