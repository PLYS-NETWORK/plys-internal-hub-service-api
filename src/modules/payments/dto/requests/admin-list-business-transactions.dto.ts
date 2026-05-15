import { PageOptionsDto } from '@common/dto/page-options.dto';
import { BusinessTransactionType, TransactionStatus } from '@database/enums';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

import { IAdminListBusinessTransactionsRequest } from './interfaces/admin-list-business-transactions.request.interface';

export class AdminListBusinessTransactionsDto
  extends PageOptionsDto
  implements IAdminListBusinessTransactionsRequest
{
  @ApiPropertyOptional({ enum: BusinessTransactionType })
  @IsEnum(BusinessTransactionType)
  @IsOptional()
  public readonly type?: BusinessTransactionType;

  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsEnum(TransactionStatus)
  @IsOptional()
  public readonly status?: TransactionStatus;

  @Expose({ name: 'business_id' })
  @ApiPropertyOptional({ name: 'business_id', format: 'uuid' })
  @IsUUID()
  @IsOptional()
  public readonly businessId?: string;

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
