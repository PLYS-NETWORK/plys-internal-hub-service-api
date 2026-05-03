import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { BusinessProfile, Project } from '@database/entities';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';

/**
 * Centralised tenant resolution for the business-projects module. Every
 * service inside the module must call one of these methods at the entry of
 * any request that mutates or reads project-scoped data. The double check
 * (`userId + businessId` from RequestContext) defends against a tampered JWT
 * `businessId` claim that does not match the authenticated user.
 */
@Injectable()
export class BusinessAccessService {
  private readonly logger = new AppLogger(BusinessAccessService.name, this.requestContext);

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {}

  /**
   * Resolves and verifies the BusinessProfile for the calling user.
   * @returns The verified profile.
   * @throws TranslatableException 403 BUSINESS_PROFILE_NOT_FOUND.
   */
  public async resolveBusinessProfile(): Promise<BusinessProfile> {
    const userId = this.requestContext.userId;
    const businessId = this.requestContext.businessId;
    if (!userId || !businessId) {
      this.logger.warn(
        `resolveBusinessProfile — missing context | userId: ${userId}, businessId: ${businessId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }
    const profile = await this.uow.businessProfiles.findOneByUserAndId(userId, businessId);
    if (!profile) {
      this.logger.warn(
        `resolveBusinessProfile — profile mismatch | userId: ${userId}, businessId: ${businessId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }
    return profile;
  }

  /**
   * Resolves the BusinessProfile and loads the project, asserting ownership.
   * @returns Both the project and the owning profile.
   * @throws TranslatableException 403 BUSINESS_PROFILE_NOT_FOUND.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   */
  public async resolveOwnedProject(
    projectId: string,
  ): Promise<{ project: Project; businessProfile: BusinessProfile }> {
    const businessProfile = await this.resolveBusinessProfile();
    const project = await this.uow.projects.findByIdAndBusinessId(projectId, businessProfile.id);
    if (!project) {
      this.logger.warn(
        `resolveOwnedProject — not found | projectId: ${projectId}, businessId: ${businessProfile.id}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.not_found',
        errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }
    return { project, businessProfile };
  }
}
