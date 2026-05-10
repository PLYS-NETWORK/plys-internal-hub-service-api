import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EmailService } from '@common/modules/email/email.service';
import { EnvironmentsService } from '@common/modules/environments';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ConsultantSkillScore } from '@database/entities';
import { ApplicationStatus } from '@database/enums';
import {
  BLOCK_MONTHS,
  CONSULTANT_APPLICATION_JOBS,
  CONSULTANT_APPLICATION_QUEUE,
} from '@modules/consultant-application/consultant-application.constants';
import { AdminDecideDto } from '@modules/consultant-application/dto/requests/admin-decide.dto';
import { ListApplicationsDto } from '@modules/consultant-application/dto/requests/list-applications.dto';
import {
  AnswerDetailResponseDto,
  ApplicationDetailResponseDto,
} from '@modules/consultant-application/dto/responses/application-detail-response.dto';
import {
  ApplicationListItemResponseDto,
  IPaginatedApplicationsResponse,
} from '@modules/consultant-application/dto/responses/paginated-applications-response.dto';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { InjectQueue } from '@nestjs/bull';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { plainToInstance } from 'class-transformer';

import { IAdminApplicationService } from '../interfaces/admin-application.service.interface';

@Injectable()
export class AdminApplicationService implements IAdminApplicationService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly emailService: EmailService,
    private readonly envService: EnvironmentsService,
    private readonly requestContext: RequestContextService,
    @InjectQueue(CONSULTANT_APPLICATION_QUEUE)
    private readonly queue: Queue,
  ) {
    this.logger = new AppLogger(AdminApplicationService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async listApplications(dto: ListApplicationsDto): Promise<IPaginatedApplicationsResponse> {
    this.logger.log(
      `[${this.rid}] listApplications — start | page: ${dto.page}, take: ${dto.take}`,
    );

    const [items, total] = await this.uow.consultantApplications.findManyWithFilters({
      status: dto.status,
      keyword: dto.keyword,
      page: dto.page,
      take: dto.take,
    });

    const pageCount = Math.ceil(total / dto.take);

    return {
      data: items.map((item) =>
        plainToInstance(
          ApplicationListItemResponseDto,
          {
            id: item.id,
            consultant_email: item.user?.email ?? '',
            status: item.status,
            created_at: item.createdAt.toISOString(),
            interview_submitted_at: item.interviewSubmittedAt
              ? item.interviewSubmittedAt.toISOString()
              : null,
            final_score: item.finalScore ? parseFloat(item.finalScore) : null,
          },
          { excludeExtraneousValues: true },
        ),
      ),
      meta: {
        page: dto.page,
        take: dto.take,
        item_count: total,
        page_count: pageCount,
        has_previous_page: dto.page > 1,
        has_next_page: dto.page < pageCount,
      },
    };
  }

  /** @inheritdoc */
  public async getApplicationDetail(applicationId: string): Promise<ApplicationDetailResponseDto> {
    this.logger.log(`[${this.rid}] getApplicationDetail — start | applicationId: ${applicationId}`);

    const application = await this.uow.consultantApplications.findOne({
      where: { id: applicationId },
      relations: ['user'],
    });

    if (!application) {
      throw new TranslatableException({
        messageKey: 'error.consultant_application.not_found',
        errorCode: ERROR_CODES.CONSULTANT_APPLICATION_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const assignedQuestions =
      await this.uow.applicationQuestions.findByApplicationId(applicationId);
    const answers = await this.uow.applicationAnswers.findByApplicationId(applicationId);

    const answerMap = new Map(answers.map((a) => [a.applicationQuestion?.id ?? '', a]));

    const answerDtos = assignedQuestions.map((aq) => {
      const answer = answerMap.get(aq.id);
      return plainToInstance(
        AnswerDetailResponseDto,
        {
          application_question_id: aq.id,
          question_order: aq.questionOrder,
          type: aq.type,
          content: aq.contentSnapshot,
          answer_text: answer?.answerText ?? null,
          // Numeric columns come back as strings from TypeORM — parse before exposing
          copyleaks_ai_score: answer?.copyleaksAiScore ? parseFloat(answer.copyleaksAiScore) : null,
          ai_eval_score: answer?.aiEvalScore ? parseFloat(answer.aiEvalScore) : null,
          ai_feedback: answer?.aiFeedback ?? null,
          admin_score: answer?.adminScore ? parseFloat(answer.adminScore) : null,
          admin_notes: answer?.adminNotes ?? null,
        },
        { excludeExtraneousValues: true },
      );
    });

    return plainToInstance(
      ApplicationDetailResponseDto,
      {
        id: application.id,
        status: application.status,
        consultant_email: application.user?.email ?? '',
        profile_submitted_at: application.profileSubmittedAt?.toISOString() ?? null,
        interview_submitted_at: application.interviewSubmittedAt?.toISOString() ?? null,
        copyleaks_score: application.copyleaksScore ? parseFloat(application.copyleaksScore) : null,
        ai_eval_score: application.aiEvalScore ? parseFloat(application.aiEvalScore) : null,
        admin_eval_score: application.adminEvalScore
          ? parseFloat(application.adminEvalScore)
          : null,
        final_score: application.finalScore ? parseFloat(application.finalScore) : null,
        blocked_until: application.blockedUntil?.toISOString() ?? null,
        rejection_reason: application.rejectionReason ?? null,
        answers: answerDtos,
        created_at: application.createdAt.toISOString(),
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public toListItemDto(item: {
    id: string;
    user: { email: string };
    status: unknown;
    createdAt: Date;
    interviewSubmittedAt: Date | null;
    finalScore: number | null;
  }): ApplicationListItemResponseDto {
    return plainToInstance(
      ApplicationListItemResponseDto,
      {
        id: item.id,
        consultant_email: item.user?.email ?? '',
        status: item.status,
        created_at: item.createdAt.toISOString(),
        interview_submitted_at: item.interviewSubmittedAt?.toISOString() ?? null,
        final_score: item.finalScore ?? null,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async startEvaluation(applicationId: string): Promise<void> {
    const adminId = this.requestContext.userId!;
    this.logger.log(
      `[${this.rid}] startEvaluation — start | applicationId: ${applicationId}, adminId: ${adminId}`,
    );

    await this.uow.withTransaction(async (tx) => {
      const application = await tx.consultantApplications.findOne({
        where: { id: applicationId },
      });

      if (!application) {
        throw new TranslatableException({
          messageKey: 'error.consultant_application.not_found',
          errorCode: ERROR_CODES.CONSULTANT_APPLICATION_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }

      if (application.status !== ApplicationStatus.INTERVIEW_SUBMITTED) {
        throw new TranslatableException({
          messageKey: 'error.consultant_application.invalid_status',
          errorCode: ERROR_CODES.CONSULTANT_APPLICATION_INVALID_STATUS,
          status: HttpStatus.CONFLICT,
        });
      }

      application.status = ApplicationStatus.RUNNING_COPYLEAKS;
      application.adminTriggeredBy = adminId;
      application.adminTriggeredAt = new Date();
      await tx.consultantApplications.save(application);
    });

    await this.queue.add(
      CONSULTANT_APPLICATION_JOBS.RUN_COPYLEAKS_EVALUATION,
      { applicationId },
      { attempts: 3, backoff: { type: 'exponential', delay: 10000 } },
    );

    this.logger.log(`[${this.rid}] startEvaluation — complete | applicationId: ${applicationId}`);
  }

  /** @inheritdoc */
  public async makeDecision(applicationId: string, dto: AdminDecideDto): Promise<void> {
    const adminId = this.requestContext.userId!;
    this.logger.log(
      `[${this.rid}] makeDecision — start | applicationId: ${applicationId}, decision: ${dto.decision}`,
    );

    await this.uow.withTransaction(async (tx) => {
      const application = await tx.consultantApplications.findOne({
        where: { id: applicationId },
        relations: ['user'],
      });

      if (!application) {
        throw new TranslatableException({
          messageKey: 'error.consultant_application.not_found',
          errorCode: ERROR_CODES.CONSULTANT_APPLICATION_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }

      if (application.status !== ApplicationStatus.PENDING_FINAL_DECISION) {
        throw new TranslatableException({
          messageKey: 'error.consultant_application.invalid_status',
          errorCode: ERROR_CODES.CONSULTANT_APPLICATION_INVALID_STATUS,
          status: HttpStatus.CONFLICT,
        });
      }

      application.reviewedBy = adminId;
      application.reviewedAt = new Date();

      if (dto.decision === 'APPROVED') {
        application.status = ApplicationStatus.APPROVED;

        // Mark consultant profile as verified
        const profile = await tx.consultantProfiles.findByUserId(application.userId);
        if (profile) {
          profile.isVerified = true;
          await tx.consultantProfiles.save(profile);

          // Save per-skill scores
          const answers = await tx.applicationAnswers.findByApplicationId(applicationId);
          const skillScoreMap = new Map<string, number[]>();

          for (const answer of answers) {
            const skillId = answer.applicationQuestion?.skillId;
            if (skillId && answer.aiEvalScore !== null) {
              const current = skillScoreMap.get(skillId) ?? [];
              // aiEvalScore is stored as string (numeric TypeORM column)
              current.push(parseFloat(answer.aiEvalScore));
              skillScoreMap.set(skillId, current);
            }
          }

          for (const [skillId, scores] of skillScoreMap.entries()) {
            const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
            const roundedScore = String(parseFloat(avgScore.toFixed(2)));
            const existing = await tx.consultantSkillScores.findOne({
              where: { consultantId: profile.id, skillId },
            });

            if (existing) {
              existing.score = roundedScore;
              existing.calculatedAt = new Date();
              existing.applicationId = applicationId;
              await tx.consultantSkillScores.save(existing);
            } else {
              const newScore = tx.consultantSkillScores.create({
                consultantId: profile.id,
                skillId,
                applicationId,
                score: roundedScore,
                calculatedAt: new Date(),
              }) as ConsultantSkillScore;
              await tx.consultantSkillScores.save(newScore);
            }
          }
        }

        await tx.consultantApplications.save(application);

        void this.emailService
          .sendApplicationApprovedEmail(application.user.email, {
            userName: application.user.email,
            dashboardUrl: this.envService.lonaUrl ?? '',
          })
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(
              `[${this.rid}] makeDecision — approval email failed | applicationId: ${applicationId} | error: ${msg}`,
            );
          });
      } else {
        // REJECTED
        const blockedUntil = new Date();
        blockedUntil.setMonth(blockedUntil.getMonth() + BLOCK_MONTHS);

        application.status = ApplicationStatus.REJECTED;
        application.blockedUntil = blockedUntil;
        application.rejectionReason = dto.rejectionReason ?? 'LOW_SCORE';
        await tx.consultantApplications.save(application);

        void this.emailService
          .sendApplicationRejectedEmail(application.user.email, {
            userName: application.user.email,
            reason: dto.rejectionReason ?? 'Score did not meet the minimum threshold.',
            blockedUntil: blockedUntil.toISOString(),
          })
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(
              `[${this.rid}] makeDecision — rejection email failed | applicationId: ${applicationId} | error: ${msg}`,
            );
          });
      }
    });

    this.logger.log(
      `[${this.rid}] makeDecision — complete | applicationId: ${applicationId}, decision: ${dto.decision}`,
    );
  }
}
