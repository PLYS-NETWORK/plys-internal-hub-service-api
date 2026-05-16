import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { AdminUsersBreakdownResponseDto } from '../../dto/responses/admin-users-breakdown-response.dto';
import { IAdminUsersBreakdownService } from '../interfaces/admin-users-breakdown-service.interface';

@Injectable()
export class AdminUsersBreakdownService implements IAdminUsersBreakdownService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(AdminUsersBreakdownService.name, requestContext);
  }

  /** @inheritdoc */
  public async get(): Promise<AdminUsersBreakdownResponseDto> {
    this.logger.log('get — start');
    const breakdown = await this.uow.users.countByPlatformGroupedByStatus();
    this.logger.log(
      `get — complete | business_total: ${breakdown.business.total}, consultant_total: ${breakdown.consultant.total}`,
    );
    return plainToInstance(AdminUsersBreakdownResponseDto, breakdown, {
      excludeExtraneousValues: true,
    });
  }
}
