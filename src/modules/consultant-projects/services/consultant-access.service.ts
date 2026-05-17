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
} from '../interfaces/consultant-access.service.interface';

// Statuses that a consultant may discover or open from the public feed. The
// detail repo query OR's this with an ACTIVE membership check so members
// keep access even after a project moves outside this set.
export const ACCESSIBLE_PROJECT_STATUSES: readonly ProjectStatus[] = [
  ProjectStatus.PUBLISHED,
  ProjectStatus.IN_PROGRESS,
];

@Injectable()
export class ConsultantAccessService implements IConsultantAccessService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(ConsultantAccessService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async resolveConsultantProfile(): Promise<ConsultantProfile> {
    const userId = this.requestContext.userId;
    if (!userId) {
      this.logger.warn(`[${this.rid}] resolveConsultantProfile — missing userId`);
      throw this.consultantProfileNotFound();
    }
    const profile = await this.uow.consultantProfiles.findByUserId(userId);
    if (!profile) {
      this.logger.warn(
        `[${this.rid}] resolveConsultantProfile — profile not found | userId: ${userId}`,
      );
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
        `[${this.rid}] resolveAccessibleProject — not found | projectId: ${projectId}, consultantId: ${consultantProfile.id}`,
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
  public async resolveJoinedProject(projectId: string): Promise<IResolvedAccessibleProject> {
    const consultantProfile = await this.resolveConsultantProfile();
    const membership = await this.uow.projectMembers.findByProjectAndConsultant(
      projectId,
      consultantProfile.id,
    );
    if (!membership || membership.status !== ProjectMemberStatus.ACTIVE) {
      // 404 not 403 — leaking project existence to non-members would invite
      // ID enumeration. Active-only gating is the whole point of this method.
      this.logger.warn(
        `[${this.rid}] resolveJoinedProject — not an active member | projectId: ${projectId}, consultantId: ${consultantProfile.id}`,
      );
      throw this.projectNotFound();
    }
    const project = await this.uow.projects.findOne({ where: { id: projectId } });
    if (!project) {
      this.logger.warn(
        `[${this.rid}] resolveJoinedProject — project row missing | projectId: ${projectId}`,
      );
      throw this.projectNotFound();
    }
    return { project, consultantProfile };
  }

  private consultantProfileNotFound(): TranslatableException {
    return new TranslatableException({
      messageKey: 'error.consultant_profile.not_found',
      errorCode: ERROR_CODES.CONSULTANT_PROFILE_NOT_FOUND,
      status: HttpStatus.FORBIDDEN,
    });
  }

  private projectNotFound(): TranslatableException {
    return new TranslatableException({
      messageKey: 'error.project.not_found',
      errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    });
  }
}
