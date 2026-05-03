import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ConsultantProfile } from '@database/entities';
import { ProjectMemberStatus, ProjectStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';

import {
  IConsultantAccessService,
  IResolvedAccessibleProject,
  IResolvedProjectMembership,
} from '../interfaces/consultant-access.service.interface';

// Statuses a consultant may discover or open from the public feed.
// Mirrors the contract of `findAccessibleByIdForConsultant` in ProjectRepository.
export const ACCESSIBLE_PROJECT_STATUSES: readonly ProjectStatus[] = [
  ProjectStatus.PUBLISHED,
  ProjectStatus.IN_PROGRESS,
];

/**
 * Centralised tenant resolution for the consultant-projects module. Mirrors
 * `BusinessAccessService` — every entry point should call one of these
 * methods to verify the caller's identity before any business logic runs.
 */
@Injectable()
export class ConsultantAccessService implements IConsultantAccessService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(ConsultantAccessService.name, requestContext);
  }

  /** @inheritdoc */
  public async resolveConsultantProfile(): Promise<ConsultantProfile> {
    const userId = this.requestContext.userId;
    if (!userId) {
      this.logger.warn(`resolveConsultantProfile — missing userId`);
      throw this.consultantProfileNotFound();
    }
    const profile = await this.uow.consultantProfiles.findByUserId(userId);
    if (!profile) {
      this.logger.warn(`resolveConsultantProfile — profile not found | userId: ${userId}`);
      throw this.consultantProfileNotFound();
    }
    return profile;
  }

  /** @inheritdoc */
  public async resolveAccessibleProject(projectId: string): Promise<IResolvedAccessibleProject> {
    const consultantProfile = await this.resolveConsultantProfile();
    const project = await this.uow.projects.findAccessibleByIdForConsultant(
      projectId,
      consultantProfile.id,
      [...ACCESSIBLE_PROJECT_STATUSES],
    );
    if (!project) {
      this.logger.warn(
        `resolveAccessibleProject — not found | projectId: ${projectId}, consultantId: ${consultantProfile.id}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.not_found',
        errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }
    return { project, consultantProfile };
  }

  /** @inheritdoc */
  public async resolveProjectMembership(projectId: string): Promise<IResolvedProjectMembership> {
    const consultantProfile = await this.resolveConsultantProfile();
    const project = await this.uow.projects.findOne({ where: { id: projectId } });
    if (!project) {
      this.logger.warn(`resolveProjectMembership — project not found | projectId: ${projectId}`);
      throw new TranslatableException({
        messageKey: 'error.project.not_found',
        errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const member = await this.uow.projectMembers.findOne({
      where: {
        projectId,
        consultantId: consultantProfile.id,
        status: ProjectMemberStatus.ACTIVE,
      },
    });
    if (!member) {
      this.logger.warn(
        `resolveProjectMembership — not a member | projectId: ${projectId}, consultantId: ${consultantProfile.id}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.forbidden',
        errorCode: ERROR_CODES.PROJECT_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      });
    }

    return { project, consultantProfile, member };
  }

  private consultantProfileNotFound(): TranslatableException {
    return new TranslatableException({
      messageKey: 'error.consultant_profile.not_found',
      errorCode: ERROR_CODES.CONSULTANT_PROFILE_NOT_FOUND,
      status: HttpStatus.FORBIDDEN,
    });
  }
}
