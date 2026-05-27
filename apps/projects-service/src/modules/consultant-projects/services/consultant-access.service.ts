import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { ProjectMemberStatus, ProjectStatus } from '@plys/libraries/database/enums';
import {
  IConsultantProfileSnapshot,
  IProfilesReader,
  PROFILES_READER,
} from '@plys/libraries/profiles-port';
import { ProjectsUnitOfWorkService } from '@plys/libraries/unit-of-work/projects-unit-of-work.service';

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
    private readonly uow: ProjectsUnitOfWorkService,
    @Inject(PROFILES_READER) private readonly profilesReader: IProfilesReader,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(ConsultantAccessService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async resolveConsultantProfile(): Promise<IConsultantProfileSnapshot> {
    const userId = this.requestContext.userId;
    if (!userId) {
      this.logger.warn(`[${this.rid}] resolveConsultantProfile — missing userId`);
      throw this.consultantProfileNotFound();
    }
    const profile = await this.profilesReader.findConsultantByUserId(userId);
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
      throw this.projectNotFound();
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
