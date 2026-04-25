import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EmailService } from '@common/modules/email/email.service';
import { EnvironmentsService } from '@common/modules/environments/environments.service';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ApplicationStatus, ProjectMemberStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Not } from 'typeorm';

import { ListProjectApplicationsDto, ReviewApplicationDto } from '../dto/requests';
import { ApplicationResponseDto, BusinessApplicationListItemResponseDto } from '../dto/responses';

@Injectable()
export class BusinessApplicationService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly emailService: EmailService,
    private readonly envService: EnvironmentsService,
  ) {
    this.logger = new AppLogger(BusinessApplicationService.name, requestContext);
  }

  /**
   * Lists all applications for a specific project owned by the current business.
   * Always ordered by applied_at DESC. Optionally filtered by status.
   */
  public async listProjectApplications(
    projectId: string,
    dto: ListProjectApplicationsDto,
  ): Promise<PageDto<BusinessApplicationListItemResponseDto>> {
    const businessId = await this.resolveBusinessId();
    this.logger.log(
      `listProjectApplications — start | businessId: ${businessId}, projectId: ${projectId}, page: ${dto.page}`,
    );

    // Verify project belongs to this business
    const project = await this.uow.projects.findByIdAndBusinessId(projectId, businessId);
    if (!project) {
      this.logger.warn(
        `listProjectApplications — project not found | projectId: ${projectId}, businessId: ${businessId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.not_found',
        errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const [applications, itemCount] = await this.uow.projectApplications.findAndCount({
      where: {
        projectId,
        status: dto.status ?? Not(ApplicationStatus.WITHDRAWN),
      },
      relations: ['consultant'],
      order: { appliedAt: 'DESC' },
      skip: dto.skip,
      take: dto.limit,
    });

    const data = applications.map((app) =>
      plainToInstance(
        BusinessApplicationListItemResponseDto,
        {
          id: app.id,
          project_id: app.projectId,
          consultant: {
            id: app.consultant.id,
            full_name: app.consultant.fullName,
            avatar_url: app.consultant.avatarUrl ?? null,
          },
          status: app.status,
          cover_letter: app.coverLetter ?? null,
          applied_at: app.appliedAt.toISOString(),
          reviewed_at: app.reviewedAt?.toISOString() ?? null,
        },
        { excludeExtraneousValues: true },
      ),
    );

    const meta = new PageMetaDto({ pageOptionsDto: dto, itemCount });

    this.logger.log(
      `listProjectApplications — complete | returned: ${data.length}, total: ${itemCount}`,
    );
    return new PageDto(data, meta);
  }

  /**
   * Approves or rejects a pending application.
   *
   * On approve: creates a ProjectMember row and sends a congratulations email.
   * On reject: updates the rejection reason and sends a decline email.
   */
  public async reviewApplication(
    applicationId: string,
    dto: ReviewApplicationDto,
  ): Promise<ApplicationResponseDto> {
    const businessId = await this.resolveBusinessId();
    const userId = this.requestContext.userId!;
    this.logger.log(
      `reviewApplication — start | applicationId: ${applicationId}, action: ${dto.action}`,
    );

    // Fetch application with project relation and verify ownership
    const application = await this.uow.projectApplications.findOne({
      where: { id: applicationId },
      relations: ['project', 'consultant'],
    });

    if (!application || application.project.businessId !== businessId) {
      this.logger.warn(
        `reviewApplication — not found or forbidden | applicationId: ${applicationId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.application.not_found',
        errorCode: ERROR_CODES.APPLICATION_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    // Validate status transition — both approve and reject require PENDING
    if (application.status !== ApplicationStatus.PENDING) {
      const errorCode =
        dto.action === 'approve'
          ? ERROR_CODES.APPLICATION_CANNOT_APPROVE
          : ERROR_CODES.APPLICATION_CANNOT_REJECT;
      const messageKey =
        dto.action === 'approve'
          ? 'error.application.cannot_approve'
          : 'error.application.cannot_reject';
      this.logger.warn(
        `reviewApplication — invalid status | applicationId: ${applicationId}, currentStatus: ${application.status}`,
      );
      throw new TranslatableException({
        messageKey,
        errorCode,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const newStatus =
      dto.action === 'approve' ? ApplicationStatus.ACCEPTED : ApplicationStatus.REJECTED;

    const updatedApplication = await this.uow.withTransaction(async (txUow) => {
      application.status = newStatus;
      application.reviewedBy = userId;
      application.reviewedAt = new Date();
      if (dto.action === 'reject') {
        application.rejectionReason = dto.rejectionReason ?? null;
      }
      const saved = await txUow.projectApplications.save(application);

      // On approve, add the consultant as a project member
      if (dto.action === 'approve') {
        const member = txUow.projectMembers.create({
          projectId: application.projectId,
          consultantId: application.consultantId,
          applicationId: application.id,
          status: ProjectMemberStatus.ACTIVE,
        });
        await txUow.projectMembers.save(member);
      }

      return saved;
    });

    this.logger.log(
      `reviewApplication — complete | applicationId: ${applicationId}, newStatus: ${newStatus}`,
    );

    // Send status email to consultant (fire-and-forget)
    this.sendStatusEmail(application, dto);

    return plainToInstance(
      ApplicationResponseDto,
      {
        id: updatedApplication.id,
        project_id: updatedApplication.projectId,
        status: updatedApplication.status,
        cover_letter: updatedApplication.coverLetter ?? null,
        matched_skills: [],
        applied_at: updatedApplication.appliedAt.toISOString(),
      },
      { excludeExtraneousValues: true },
    );
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async resolveBusinessId(): Promise<string> {
    const userId = this.requestContext.userId!;
    const profile = await this.uow.businessProfiles.findByUserId(userId);

    if (!profile) {
      this.logger.warn(`resolveBusinessId — not found | userId: ${userId}`);
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }

    return profile.id;
  }

  /**
   * Sends an approval/rejection email to the consultant.
   * Fire-and-forget — failures are logged but do not affect the response.
   */
  private sendStatusEmail(
    application: {
      consultant: { userId: string; fullName: string };
      project: { id: string; title: string };
    },
    dto: ReviewApplicationDto,
  ): void {
    void (async (): Promise<void> => {
      try {
        const consultantUser = await this.uow.users.findByActiveId(application.consultant.userId);
        if (!consultantUser) return;

        const projectUrl =
          dto.action === 'approve'
            ? `${this.envService.lonaUrl}/projects/${application.project.id}`
            : undefined;

        await this.emailService.sendApplicationStatusEmail(consultantUser.email, {
          consultantName: application.consultant.fullName,
          projectTitle: application.project.title,
          status: dto.action === 'approve' ? 'approved' : 'rejected',
          rejectionReason: dto.rejectionReason,
          projectUrl,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`sendStatusEmail — failed | error: ${msg}`);
      }
    })();
  }
}
