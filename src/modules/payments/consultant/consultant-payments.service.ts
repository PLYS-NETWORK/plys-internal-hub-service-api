import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { ConsultantTransactionResponseDto } from '../dto/responses';
import { IConsultantPaymentsService } from './interfaces/consultant-payments-service.interface';

@Injectable()
export class ConsultantPaymentsService implements IConsultantPaymentsService {
  private readonly logger = new Logger(ConsultantPaymentsService.name);

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {}

  public async listTransactions(
    dto: PageOptionsDto,
  ): Promise<PageDto<ConsultantTransactionResponseDto>> {
    const userId = this.requestContext.userId!;
    this.logger.log(
      `[${this.rid}] listTransactions — start | userId: ${userId}, page: ${dto.page}, limit: ${dto.limit}`,
    );

    const consultantProfile = await this.uow.consultantProfiles.findOne({ where: { userId } });
    if (!consultantProfile) {
      throw new TranslatableException({
        messageKey: 'error.consultant_profile.not_found',
        errorCode: ERROR_CODES.CONSULTANT_PROFILE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const [transactions, itemCount] = await this.uow.consultantTransactions.findAndCount({
      where: { consultantId: consultantProfile.id },
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
      `[${this.rid}] listTransactions — complete | count: ${transactions.length}, total: ${itemCount}`,
    );

    return new PageDto(data, meta);
  }
}
