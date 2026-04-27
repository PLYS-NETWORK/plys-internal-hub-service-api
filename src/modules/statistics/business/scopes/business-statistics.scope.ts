import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable, Scope } from '@nestjs/common';

import { IStatisticsScope } from '../../shared/interfaces';

/**
 * BUSINESS-platform implementation of {@link IStatisticsScope}. Resolves the
 * caller's `business_profile.id` from `RequestContextService` and exposes the
 * project IDs that belong to that business. Both lookups are memoised for the
 * lifetime of one HTTP request — the scope is registered as REQUEST-scoped.
 */
@Injectable({ scope: Scope.REQUEST })
export class BusinessStatisticsScope implements IStatisticsScope {
  private cachedBusinessId: string | null = null;
  private cachedProjectIds: string[] | null = null;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {}

  /** @inheritdoc */
  public async getBusinessId(): Promise<string> {
    if (this.cachedBusinessId) return this.cachedBusinessId;

    const userId = this.requestContext.userId;
    if (!userId) {
      throw new TranslatableException({
        messageKey: 'error.auth.token_invalid',
        errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    const profile = await this.uow.businessProfiles.findByUserId(userId);
    if (!profile) {
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }

    this.cachedBusinessId = profile.id;
    return profile.id;
  }

  /** @inheritdoc */
  public async getOwnedProjectIds(): Promise<string[]> {
    if (this.cachedProjectIds) return this.cachedProjectIds;

    const businessId = await this.getBusinessId();
    const ids = await this.uow.projects.findIdsByBusinessId(businessId);
    this.cachedProjectIds = ids;
    return ids;
  }
}
