import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { ListConsultantTransactionsDto } from '../dto/requests/list-consultant-transactions.dto';
import { ConsultantTransactionResponseDto } from '../dto/responses';
import { IConsultantPaymentsService } from './interfaces/consultant-payments-service.interface';

@Injectable()
export class ConsultantPaymentsService implements IConsultantPaymentsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(ConsultantPaymentsService.name, requestContext);
  }

  /** @inheritdoc */
  public async listTransactions(
    dto: ListConsultantTransactionsDto,
  ): Promise<PageDto<ConsultantTransactionResponseDto>> {
    const userId = this.requestContext.userId!;
    this.logger.log(
      `listTransactions — start | userId: ${userId}, page: ${dto.page}, limit: ${dto.limit}`,
    );

    const consultantProfile = await this.uow.consultantProfiles.findOne({ where: { userId } });
    if (!consultantProfile) {
      throw new TranslatableException({
        messageKey: 'error.consultant_profile.not_found',
        errorCode: ERROR_CODES.CONSULTANT_PROFILE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const where: Record<string, unknown> = { consultantId: consultantProfile.id };
    if (dto.type) where['type'] = dto.type;
    if (dto.status) where['status'] = dto.status;

    const [transactions, itemCount] = await this.uow.consultantTransactions.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: dto.skip,
      take: dto.limit,
    });

    const data = transactions.map((tx) =>
      plainToInstance(
        ConsultantTransactionResponseDto,
        {
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          status: tx.status,
          withdrawal_method: tx.withdrawalMethod,
          note: tx.note,
          created_at: tx.createdAt,
        },
        { excludeExtraneousValues: true },
      ),
    );

    const meta = new PageMetaDto({ pageOptionsDto: dto, itemCount });

    this.logger.log(
      `listTransactions — complete | count: ${transactions.length}, total: ${itemCount}`,
    );

    return new PageDto(data, meta);
  }
}
