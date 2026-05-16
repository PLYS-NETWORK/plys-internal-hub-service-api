import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { DateUtil } from '@common/utils/date';
import { BusinessTransaction } from '@database/entities/finance/business-transaction.entity';
import { ConsultantTransaction } from '@database/entities/finance/consultant-transaction.entity';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Between, FindOperator, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

import { AdminListBusinessTransactionsDto } from '../dto/requests/admin-list-business-transactions.dto';
import { AdminListConsultantTransactionsDto } from '../dto/requests/admin-list-consultant-transactions.dto';
import {
  AdminBusinessTransactionResponseDto,
  AdminConsultantTransactionResponseDto,
} from '../dto/responses';
import { IAdminPaymentsService } from './interfaces/admin-payments-service.interface';

@Injectable()
export class AdminPaymentsService implements IAdminPaymentsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(AdminPaymentsService.name, requestContext);
  }

  /** @inheritdoc */
  public async listConsultantTransactions(
    dto: AdminListConsultantTransactionsDto,
  ): Promise<PageDto<AdminConsultantTransactionResponseDto>> {
    this.logger.log(
      `listConsultantTransactions — start | page: ${dto.page}, limit: ${dto.limit}, ` +
        `type: ${dto.type ?? '-'}, status: ${dto.status ?? '-'}, ` +
        `consultant_id: ${dto.consultantId ?? '-'}, ` +
        `created_from: ${dto.createdFrom?.toISOString() ?? '-'}, ` +
        `created_to: ${dto.createdTo?.toISOString() ?? '-'}`,
    );

    const where: FindOptionsWhere<ConsultantTransaction> = {
      ...(dto.type ? { type: dto.type } : {}),
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.consultantId ? { consultantId: dto.consultantId } : {}),
      ...(dto.createdFrom || dto.createdTo
        ? { createdAt: this.buildDateRangeOperator(dto.createdFrom, dto.createdTo) }
        : {}),
    };

    const [rows, itemCount] = await this.uow.consultantTransactions.findAndCount({
      where,
      relations: { consultant: { user: true } },
      order: { createdAt: 'DESC' },
      skip: dto.skip,
      take: dto.limit,
    });

    const tz = this.requestContext.timezone ?? 'UTC';

    const data = rows.map((tx) =>
      plainToInstance(
        AdminConsultantTransactionResponseDto,
        {
          id: tx.id,
          transaction_number: tx.transactionNumber,
          type: tx.type,
          amount: tx.amount,
          commission_rate: tx.commissionRate,
          commission_amount: tx.commissionAmount,
          total_amount: tx.totalAmount,
          status: tx.status,
          withdrawal_method: tx.withdrawalMethod,
          note: tx.note,
          created_at: DateUtil.toZonedIso(tx.createdAt, tz),
          owner: {
            id: tx.consultant.id,
            user_id: tx.consultant.userId,
            name: tx.consultant.fullName,
            email: tx.consultant.user.email,
          },
        },
        { excludeExtraneousValues: true },
      ),
    );

    const meta = new PageMetaDto({ pageOptionsDto: dto, itemCount });

    this.logger.log(
      `listConsultantTransactions — complete | count: ${rows.length}, total: ${itemCount}`,
    );

    return new PageDto(data, meta);
  }

  /** @inheritdoc */
  public async listBusinessTransactions(
    dto: AdminListBusinessTransactionsDto,
  ): Promise<PageDto<AdminBusinessTransactionResponseDto>> {
    this.logger.log(
      `listBusinessTransactions — start | page: ${dto.page}, limit: ${dto.limit}, ` +
        `type: ${dto.type ?? '-'}, status: ${dto.status ?? '-'}, ` +
        `business_id: ${dto.businessId ?? '-'}, ` +
        `created_from: ${dto.createdFrom?.toISOString() ?? '-'}, ` +
        `created_to: ${dto.createdTo?.toISOString() ?? '-'}`,
    );

    const where: FindOptionsWhere<BusinessTransaction> = {
      ...(dto.type ? { type: dto.type } : {}),
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.businessId ? { businessId: dto.businessId } : {}),
      ...(dto.createdFrom || dto.createdTo
        ? { createdAt: this.buildDateRangeOperator(dto.createdFrom, dto.createdTo) }
        : {}),
    };

    const [rows, itemCount] = await this.uow.businessTransactions.findAndCount({
      where,
      relations: { business: { user: true } },
      order: { createdAt: 'DESC' },
      skip: dto.skip,
      take: dto.limit,
    });

    const tz = this.requestContext.timezone ?? 'UTC';

    const data = rows.map((tx) =>
      plainToInstance(
        AdminBusinessTransactionResponseDto,
        {
          id: tx.id,
          transaction_number: tx.transactionNumber,
          type: tx.type,
          amount: tx.amount,
          commission_rate: tx.commissionRate,
          commission_amount: tx.commissionAmount,
          total_amount: tx.totalAmount,
          status: tx.status,
          note: tx.note,
          payer_info: this.toPayerInfoResponse(tx.payerInfo),
          created_at: DateUtil.toZonedIso(tx.createdAt, tz),
          owner: {
            id: tx.business.id,
            user_id: tx.business.userId,
            name: tx.business.companyName,
            email: tx.business.user.email,
          },
        },
        { excludeExtraneousValues: true },
      ),
    );

    const meta = new PageMetaDto({ pageOptionsDto: dto, itemCount });

    this.logger.log(
      `listBusinessTransactions — complete | count: ${rows.length}, total: ${itemCount}`,
    );

    return new PageDto(data, meta);
  }

  // Both ledgers share the same date-range filter shape; centralise the
  // operator selection so the two list methods stay symmetric. At least one of
  // `from` / `to` must be defined — callers gate on that before invoking.
  private buildDateRangeOperator(from?: Date, to?: Date): FindOperator<Date> {
    if (from && to) return Between(from, to);
    if (from) return MoreThanOrEqual(from);
    return LessThanOrEqual(to as Date);
  }

  private toPayerInfoResponse(payerInfo: BusinessTransaction['payerInfo']): {
    name: string;
    email: string;
    billing_address: {
      line1: string;
      line2: string | null;
      city: string;
      state: string | null;
      postal_code: string;
      country: string;
    };
  } | null {
    if (!payerInfo) return null;
    return {
      name: payerInfo.name,
      email: payerInfo.email,
      billing_address: {
        line1: payerInfo.billingAddress.line1,
        line2: payerInfo.billingAddress.line2,
        city: payerInfo.billingAddress.city,
        state: payerInfo.billingAddress.state,
        postal_code: payerInfo.billingAddress.postalCode,
        country: payerInfo.billingAddress.country,
      },
    };
  }
}
