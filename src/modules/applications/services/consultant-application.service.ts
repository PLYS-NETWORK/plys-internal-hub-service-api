import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { CopyleaksService } from '@common/modules/copyleaks';
import { EmailService } from '@common/modules/email/email.service';
import { EnvironmentsService } from '@common/modules/environments/environments.service';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ConsultantProfile } from '@database/entities';
import { ApplicationStatus, ProjectStatus } from '@database/enums';
import { NOTIFICATION_TYPES } from '@modules/notifications/enums/notification-type.enum';
import { NotificationDispatcherService } from '@modules/notifications/services/notification-dispatcher.service';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { ApplyProjectDto, ListMyApplicationsDto } from '../dto/requests';
import { ApplicationResponseDto, ConsultantApplicationListItemResponseDto } from '../dto/responses';

/** Statuses where the project accepts new applications. */
const ACCEPTING_STATUSES = new Set<ProjectStatus>([
  ProjectStatus.PUBLISHED,
  ProjectStatus.IN_PROGRESS,
]);

@Injectable()
export class ConsultantApplicationService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly emailService: EmailService,
    private readonly copyleaksService: CopyleaksService,
    private readonly envService: EnvironmentsService,
    private readonly notificationDispatcher: NotificationDispatcherService,
  ) {
    this.logger = new AppLogger(ConsultantApplicationService.name, requestContext);
  }

  /**
   * Full application flow for a consultant applying to a project.
   *
   * Path A — No interview questions:
   *   Skills match check → create application → send notification emails.
   *
   * Path B — Has interview questions:
   *   Skills match check → validate answers → Copyleaks AI check →
   *   create application + answers → send notification emails.
   */
  public async applyToProject(dto: ApplyProjectDto): Promise<ApplicationResponseDto> {
    const consultantProfile = await this.resolveConsultantProfile();
    const consultantId = consultantProfile.id;
    this.logger.log(
      `applyToProject — start | consultantId: ${consultantId}, projectId: ${dto.projectId}`,
    );

    // 1. Fetch project and verify it accepts applications
    const project = await this.uow.projects.findByActiveId(dto.projectId);
    if (!project || !ACCEPTING_STATUSES.has(project.status)) {
      this.logger.warn(`applyToProject — project not accepting | projectId: ${dto.projectId}`);
      throw new TranslatableException({
        messageKey: 'error.application.project_not_accepting',
        errorCode: ERROR_CODES.APPLICATION_PROJECT_NOT_ACCEPTING,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    // 2. Check for existing pending/accepted application
    const existingApplication = await this.uow.projectApplications.findOne({
      where: {
        projectId: dto.projectId,
        consultantId,
        status: ApplicationStatus.PENDING,
      },
    });
    if (existingApplication) {
      this.logger.warn(
        `applyToProject — already applied | projectId: ${dto.projectId}, consultantId: ${consultantId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.application.already_applied',
        errorCode: ERROR_CODES.APPLICATION_ALREADY_APPLIED,
        status: HttpStatus.CONFLICT,
      });
    }

    // 3. Compute matched skills
    const [projectRequiredSkills, consultantSkills] = await Promise.all([
      this.uow.projectRequiredSkills.find({
        where: { projectId: dto.projectId },
        relations: ['skill'],
      }),
      this.uow.consultantSkills.find({
        where: { consultantId },
        relations: ['skill'],
      }),
    ]);

    const consultantSkillIds = new Set(consultantSkills.map((cs) => cs.skillId));
    const matchedSkills = projectRequiredSkills.filter((prs) =>
      consultantSkillIds.has(prs.skillId),
    );

    // If the project has required skills, at least one must match
    if (projectRequiredSkills.length > 0 && matchedSkills.length === 0) {
      this.logger.warn(
        `applyToProject — no matching skills | projectId: ${dto.projectId}, consultantId: ${consultantId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.application.no_matching_skills',
        errorCode: ERROR_CODES.APPLICATION_NO_MATCHING_SKILLS,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    // 4. Fetch interview questions
    const interviewQuestions = await this.uow.projectInterviewQuestions.find({
      where: { projectId: dto.projectId },
      order: { displayOrder: 'ASC' },
    });

    // 5. Cover letter is required when there are no interview questions
    if (interviewQuestions.length === 0 && !dto.coverLetter) {
      this.logger.warn(`applyToProject — cover letter missing | projectId: ${dto.projectId}`);
      throw new TranslatableException({
        messageKey: 'error.application.cover_letter_required',
        errorCode: ERROR_CODES.APPLICATION_COVER_LETTER_REQUIRED,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    // 6. If project has interview questions — validate answers + AI check
    if (interviewQuestions.length > 0) {
      const requiredQuestions = interviewQuestions.filter((q) => q.isRequired);
      const answeredIds = new Set((dto.answers ?? []).map((a) => a.questionId));

      // Validate all required questions are answered
      const unanswered = requiredQuestions.filter((q) => !answeredIds.has(q.id));
      if (unanswered.length > 0) {
        this.logger.warn(`applyToProject — missing answers | unanswered: ${unanswered.length}`);
        throw new TranslatableException({
          messageKey: 'error.application.missing_answers',
          errorCode: ERROR_CODES.APPLICATION_MISSING_ANSWERS,
          status: HttpStatus.BAD_REQUEST,
        });
      }

      // AI content detection via Copyleaks. The answer is now a rich-text JSON
      // document — flatten each one to plain text before sending so Copyleaks
      // sees the human-authored prose, not the editor's structural metadata.
      const answerTexts = (dto.answers ?? []).map((a) => extractPlainText(a.answer));
      try {
        const aiResult = await this.copyleaksService.checkTextsForAi(answerTexts);

        if (aiResult.hasAiContent) {
          this.logger.warn(
            `applyToProject — AI content detected | maxAiScore: ${aiResult.maxAiScore}, consultantId: ${consultantId}`,
          );

          // Send warning email to consultant (fire-and-forget — don't block the response)
          const consultantUser = await this.uow.users.findByActiveId(consultantProfile.userId);
          if (consultantUser) {
            this.emailService
              .sendAiDetectedEmail(consultantUser.email, {
                userName: consultantProfile.fullName,
                projectTitle: project.title,
              })
              .catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.error(`applyToProject — AI detected email failed | error: ${msg}`);
              });
          }

          throw new TranslatableException({
            messageKey: 'error.application.ai_detected',
            errorCode: ERROR_CODES.APPLICATION_AI_DETECTED,
            status: HttpStatus.FORBIDDEN,
          });
        }
      } catch (err: unknown) {
        // Re-throw TranslatableException (AI detected case)
        if (err instanceof TranslatableException) {
          throw err;
        }
        // Copyleaks API failure — block the application to be safe
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`applyToProject — AI check failed | error: ${msg}`);
        throw new TranslatableException({
          messageKey: 'error.application.ai_check_failed',
          errorCode: ERROR_CODES.APPLICATION_AI_CHECK_FAILED,
          status: HttpStatus.SERVICE_UNAVAILABLE,
        });
      }
    }

    // 6. Create application (+ answers if interview questions exist) inside a transaction
    const application = await this.uow.withTransaction(async (txUow) => {
      const newApplication = txUow.projectApplications.create({
        projectId: dto.projectId,
        consultantId,
        status: ApplicationStatus.PENDING,
        coverLetter: dto.coverLetter ?? null,
      });
      const savedApplication = await txUow.projectApplications.save(newApplication);

      // Save interview answers if applicable
      if (interviewQuestions.length > 0 && dto.answers) {
        const questionMap = new Map(interviewQuestions.map((q) => [q.id, q]));
        const answerEntities = dto.answers.map((a) => {
          const question = questionMap.get(a.questionId);
          return txUow.interviewAnswers.create({
            applicationId: savedApplication.id,
            questionId: a.questionId,
            questionTextSnapshot: question?.questionText ?? '',
            answer: a.answer,
          });
        });
        await txUow.interviewAnswers.save(answerEntities);
      }

      return savedApplication;
    });

    this.logger.log(
      `applyToProject — complete | applicationId: ${application.id}, matchedSkills: ${matchedSkills.length}`,
    );

    // 8. Send notification emails AFTER transaction commits (fire-and-forget)
    const applicationUrl = `${this.envService.ployosUrl}/c/${project.businessId}/projects/${project.id}`;
    this.sendNotificationEmails(project, consultantProfile, matchedSkills, applicationUrl);

    // 8b. In-app notification to the BUSINESS owner of the project. We look up
    // the owner via project.businessId so the notification routes to the human
    // user, not the BusinessProfile id. Fire-and-forget; errors are logged.
    void this.uow.businessProfiles
      .findByActiveId(project.businessId)
      .then((ownerProfile) => {
        if (!ownerProfile) {
          this.logger.warn(
            `applyToProject — owner profile vanished | businessId: ${project.businessId}`,
          );
          return null;
        }
        return this.notificationDispatcher.dispatch({
          userId: ownerProfile.userId,
          type: NOTIFICATION_TYPES.NEW_APPLICATION,
          metadata: {
            project_id: project.id,
            project_code: project.code,
            project_title: project.title,
            application_id: application.id,
            consultant_id: consultantProfile.id,
            consultant_name: consultantProfile.fullName,
          },
          actorId: consultantProfile.userId,
        });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`applyToProject — notification dispatch failed | error: ${msg}`);
      });

    // 9. Build response DTO
    return plainToInstance(
      ApplicationResponseDto,
      {
        id: application.id,
        project_id: application.projectId,
        status: application.status,
        cover_letter: application.coverLetter ?? null,
        matched_skills: matchedSkills.map((ms) => ({
          id: ms.skillId,
          name: ms.skill?.name ?? '',
        })),
        applied_at: application.appliedAt.toISOString(),
      },
      { excludeExtraneousValues: true },
    );
  }

  /**
   * Withdraws a pending application owned by the current consultant.
   */
  public async withdrawApplication(applicationId: string): Promise<ApplicationResponseDto> {
    const consultantProfile = await this.resolveConsultantProfile();
    this.logger.log(
      `withdrawApplication — start | applicationId: ${applicationId}, consultantId: ${consultantProfile.id}`,
    );

    const application = await this.uow.projectApplications.findOne({
      where: { id: applicationId, consultantId: consultantProfile.id },
    });

    if (!application) {
      this.logger.warn(`withdrawApplication — not found | applicationId: ${applicationId}`);
      throw new TranslatableException({
        messageKey: 'error.application.not_found',
        errorCode: ERROR_CODES.APPLICATION_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    if (application.status !== ApplicationStatus.PENDING) {
      this.logger.warn(
        `withdrawApplication — invalid status | applicationId: ${applicationId}, currentStatus: ${application.status}`,
      );
      throw new TranslatableException({
        messageKey: 'error.application.cannot_withdraw',
        errorCode: ERROR_CODES.APPLICATION_CANNOT_WITHDRAW,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    application.status = ApplicationStatus.WITHDRAWN;
    const updated = await this.uow.projectApplications.save(application);

    this.logger.log(`withdrawApplication — complete | applicationId: ${applicationId}`);

    return plainToInstance(
      ApplicationResponseDto,
      {
        id: updated.id,
        project_id: updated.projectId,
        status: updated.status,
        cover_letter: updated.coverLetter ?? null,
        matched_skills: [],
        applied_at: updated.appliedAt.toISOString(),
      },
      { excludeExtraneousValues: true },
    );
  }

  /**
   * Lists the current consultant's own applications, paginated and
   * optionally filtered by status. Always ordered by applied_at DESC.
   */
  public async listMyApplications(
    dto: ListMyApplicationsDto,
  ): Promise<PageDto<ConsultantApplicationListItemResponseDto>> {
    const consultantProfile = await this.resolveConsultantProfile();
    this.logger.log(
      `listMyApplications — start | consultantId: ${consultantProfile.id}, page: ${dto.page}`,
    );

    const [applications, itemCount] = await this.uow.projectApplications.findAndCount({
      where: {
        consultantId: consultantProfile.id,
        ...(dto.status && { status: dto.status }),
      },
      relations: ['project'],
      order: { appliedAt: 'DESC' },
      skip: dto.skip,
      take: dto.limit,
    });

    const data = applications.map((app) =>
      plainToInstance(
        ConsultantApplicationListItemResponseDto,
        {
          id: app.id,
          project: {
            id: app.project.id,
            title: app.project.title,
          },
          status: app.status,
          cover_letter: app.coverLetter ?? null,
          applied_at: app.appliedAt.toISOString(),
        },
        { excludeExtraneousValues: true },
      ),
    );

    const meta = new PageMetaDto({ pageOptionsDto: dto, itemCount });

    this.logger.log(
      `listMyApplications — complete | returned: ${data.length}, total: ${itemCount}`,
    );
    return new PageDto(data, meta);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async resolveConsultantProfile(): Promise<ConsultantProfile> {
    const userId = this.requestContext.userId!;
    const profile = await this.uow.consultantProfiles.findByUserId(userId);

    if (!profile) {
      this.logger.warn(`resolveConsultantProfile — not found | userId: ${userId}`);
      throw new TranslatableException({
        messageKey: 'error.consultant_profile.not_found',
        errorCode: ERROR_CODES.CONSULTANT_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }

    return profile;
  }

  /**
   * Sends notification emails to both the business owner and the consultant.
   * Fire-and-forget — failures are logged but do not affect the response.
   */
  private sendNotificationEmails(
    project: { id: string; title: string; businessId: string },
    consultantProfile: {
      userId: string;
      fullName: string;
      addressLine: string | null;
      city: string | null;
      stateProvince: string | null;
      countryCode: string | null;
    },
    matchedSkills: Array<{ skillId: string; skill?: { name: string } }>,
    applicationUrl: string,
  ): void {
    const skillNames = matchedSkills.map((ms) => ms.skill?.name ?? '');
    const address =
      [
        consultantProfile.addressLine,
        consultantProfile.city,
        consultantProfile.stateProvince,
        consultantProfile.countryCode,
      ]
        .filter(Boolean)
        .join(', ') || 'N/A';

    // Send to business owner (Ployos brand)
    void (async (): Promise<void> => {
      const businessProfile = await this.uow.businessProfiles.findByActiveId(project.businessId);
      if (businessProfile) {
        const businessUser = await this.uow.users.findByActiveId(businessProfile.userId);
        if (businessUser) {
          try {
            await this.emailService.sendApplicationNotificationToBusinessEmail(businessUser.email, {
              recipientName: businessProfile.companyName,
              projectTitle: project.title,
              consultantFullName: consultantProfile.fullName,
              matchedSkills: skillNames,
              consultantAddress: address,
              applicationUrl,
            });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(
              `sendNotificationEmails — business failed | to: ${businessUser.email} | error: ${msg}`,
            );
          }
        }
      }
    })();

    // Send to consultant (Lona brand)
    void (async (): Promise<void> => {
      const consultantUser = await this.uow.users.findByActiveId(consultantProfile.userId);
      if (consultantUser) {
        try {
          await this.emailService.sendApplicationNotificationToConsultantEmail(
            consultantUser.email,
            {
              recipientName: consultantProfile.fullName,
              projectTitle: project.title,
              consultantFullName: consultantProfile.fullName,
              matchedSkills: skillNames,
              consultantAddress: address,
            },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `sendNotificationEmails — consultant failed | to: ${consultantUser.email} | error: ${msg}`,
          );
        }
      }
    })();
  }
}

// Walks a TipTap/ProseMirror document tree and concatenates every `text` leaf
// into a single string. Used to feed Copyleaks the human-authored prose
// without the editor's structural metadata.
function extractPlainText(doc: Record<string, unknown>): string {
  const parts: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (typeof n.text === 'string') parts.push(n.text);
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
    }
  };
  walk(doc);
  return parts.join(' ').trim();
}
