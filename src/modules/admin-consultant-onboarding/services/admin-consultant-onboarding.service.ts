import { ERROR_CODES } from '@common/constants/error-codes';
import { IConsultantOnboardingApprovedEvent, NOTIFICATION_EVENTS } from '@common/events';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EmailService } from '@common/modules/email/email.service';
import { EnvironmentsService } from '@common/modules/environments';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import {
  ConsultantOnboarding,
  ConsultantOnboardingAnswer,
  ConsultantOnboardingQuestion,
  User,
} from '@database/entities';
import { OnboardingDecision, OnboardingStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';

import { ListOnboardingsDto } from '../dto/requests/list-onboardings.dto';
import { OnboardingDecisionDto } from '../dto/requests/onboarding-decision.dto';
import {
  OnboardingAnswerViewDto,
  OnboardingDetailResponseDto,
} from '../dto/responses/onboarding-detail-response.dto';
import {
  OnboardingListItemResponseDto,
  PaginatedOnboardingsResponseDto,
  PaginationMetaDto,
} from '../dto/responses/onboarding-list-item-response.dto';
import { IAdminConsultantOnboardingService } from '../interfaces/admin-consultant-onboarding.service.interface';

const BLOCK_MONTHS = 3;

@Injectable()
export class AdminConsultantOnboardingService implements IAdminConsultantOnboardingService {
  private readonly logger: AppLogger;

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly emailService: EmailService,
    private readonly env: EnvironmentsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger = new AppLogger(AdminConsultantOnboardingService.name, requestContext);
  }

  /** @inheritdoc */
  public async list(dto: ListOnboardingsDto): Promise<PaginatedOnboardingsResponseDto> {
    const page = dto.page ?? 1;
    const take = dto.take ?? 20;
    this.logger.log(`[${this.rid}] list — start | status: ${dto.status ?? 'any'} | page: ${page}`);

    const where = dto.status ? { status: dto.status as OnboardingStatus } : {};
    const [rows, total] = await this.uow.consultantOnboardings.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * take,
      take,
    });

    // Eagerly hydrate users + profiles for the listed onboardings.
    const userIds = Array.from(new Set(rows.map((r) => r.userId)));
    const users = await Promise.all(userIds.map((id) => this.uow.users.findById(id)));
    const profiles = await Promise.all(
      userIds.map((id) => this.uow.consultantProfiles.findByUserId(id)),
    );
    const userById = new Map(users.filter(Boolean).map((u) => [u!.id, u!]));
    const profileByUserId = new Map(profiles.filter(Boolean).map((p) => [p!.userId, p!]));

    const pageCount = Math.max(1, Math.ceil(total / take));
    const meta = plainToInstance(
      PaginationMetaDto,
      {
        page,
        take,
        item_count: total,
        page_count: pageCount,
        has_previous_page: page > 1,
        has_next_page: page < pageCount,
      },
      { excludeExtraneousValues: true },
    );

    const data = rows.map((row) =>
      plainToInstance(
        OnboardingListItemResponseDto,
        {
          id: row.id,
          user_id: row.userId,
          consultant_email: userById.get(row.userId)?.email ?? '',
          consultant_name: profileByUserId.get(row.userId)?.fullName ?? '',
          status: row.status,
          decision: row.decision ?? null,
          profile_submitted_at: row.profileSubmittedAt
            ? row.profileSubmittedAt.toISOString()
            : null,
          interview_submitted_at: row.interviewSubmittedAt
            ? row.interviewSubmittedAt.toISOString()
            : null,
          reviewed_at: row.reviewedAt ? row.reviewedAt.toISOString() : null,
          created_at: row.createdAt.toISOString(),
        },
        { excludeExtraneousValues: true },
      ),
    );

    return plainToInstance(
      PaginatedOnboardingsResponseDto,
      { data, meta },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async getDetail(id: string): Promise<OnboardingDetailResponseDto> {
    this.logger.log(`[${this.rid}] getDetail — start | id: ${id}`);
    const onboarding = await this.uow.consultantOnboardings.findById(id);
    if (!onboarding) {
      throw new TranslatableException({
        messageKey: 'error.consultant_onboarding.not_found',
        errorCode: ERROR_CODES.CONSULTANT_ONBOARDING_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }
    return this.buildDetail(onboarding);
  }

  /** @inheritdoc */
  public async decide(
    id: string,
    dto: OnboardingDecisionDto,
  ): Promise<OnboardingDetailResponseDto> {
    const reviewerId = this.requestContext.userId!;
    this.logger.log(
      `[${this.rid}] decide — start | id: ${id} | decision: ${dto.decision} | reviewerId: ${reviewerId}`,
    );

    const result = await this.uow.withTransaction(async (tx) => {
      const onboarding = await tx.consultantOnboardings.findById(id);
      if (!onboarding) {
        throw new TranslatableException({
          messageKey: 'error.consultant_onboarding.not_found',
          errorCode: ERROR_CODES.CONSULTANT_ONBOARDING_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }
      if (onboarding.status !== OnboardingStatus.INTERVIEW_SUBMITTED) {
        throw new TranslatableException({
          messageKey: 'error.consultant_onboarding.invalid_status',
          errorCode: ERROR_CODES.CONSULTANT_ONBOARDING_INVALID_STATUS,
          status: HttpStatus.CONFLICT,
        });
      }

      const now = new Date();
      onboarding.reviewedBy = reviewerId;
      onboarding.reviewedAt = now;
      onboarding.decision = dto.decision as OnboardingDecision;

      let blockedUntilIso: string | null = null;
      if (dto.decision === 'APPROVED') {
        onboarding.status = OnboardingStatus.APPROVED;
        const profile = await tx.consultantProfiles.findByUserId(onboarding.userId);
        if (profile) {
          profile.isVerified = true;
          await tx.consultantProfiles.save(profile);
        }
      } else {
        onboarding.status = OnboardingStatus.REJECTED;
        const blockedUntil = new Date(now);
        blockedUntil.setMonth(blockedUntil.getMonth() + BLOCK_MONTHS);
        onboarding.blockedUntil = blockedUntil;
        onboarding.rejectionNote = dto.rejection_note ?? null;
        blockedUntilIso = blockedUntil.toISOString();
      }
      await tx.consultantOnboardings.save(onboarding);

      const user = await tx.users.findById(onboarding.userId);
      const profile = await tx.consultantProfiles.findByUserId(onboarding.userId);
      return {
        onboarding,
        user,
        consultantName: profile?.fullName ?? 'Consultant',
        blockedUntilIso,
      };
    });

    // Side-effects (email + event) outside the transaction.
    await this.fireDecisionSideEffects(result, dto);

    return this.buildDetail(result.onboarding);
  }

  private async fireDecisionSideEffects(
    result: {
      onboarding: ConsultantOnboarding;
      user: User | null;
      consultantName: string;
      blockedUntilIso: string | null;
    },
    dto: OnboardingDecisionDto,
  ): Promise<void> {
    const userEmail = result.user?.email;

    if (dto.decision === 'APPROVED') {
      // In-app notification — fan-out via the notification dispatcher.
      const payload: IConsultantOnboardingApprovedEvent = {
        consultant_user_id: result.onboarding.userId,
        onboarding_id: result.onboarding.id,
      };
      this.eventEmitter.emit(NOTIFICATION_EVENTS.CONSULTANT_ONBOARDING_APPROVED, payload);

      if (userEmail) {
        try {
          await this.emailService.sendApplicationApprovedEmail(userEmail, {
            userName: result.consultantName,
            dashboardUrl: this.env.ployosUrl,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`[${this.rid}] approved email — failed | error: ${msg}`);
        }
      }
      return;
    }

    // REJECTED branch.
    if (userEmail && result.blockedUntilIso) {
      try {
        await this.emailService.sendApplicationRejectedEmail(userEmail, {
          userName: result.consultantName,
          reason: dto.rejection_note ?? 'Onboarding did not meet our criteria.',
          blockedUntil: result.blockedUntilIso,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[${this.rid}] rejected email — failed | error: ${msg}`);
      }
    }
  }

  private async buildDetail(
    onboarding: ConsultantOnboarding,
  ): Promise<OnboardingDetailResponseDto> {
    const [user, profile, questions, answers] = await Promise.all([
      this.uow.users.findById(onboarding.userId),
      this.uow.consultantProfiles.findByUserId(onboarding.userId),
      this.uow.consultantOnboardingQuestions.findByOnboardingId(onboarding.id),
      this.uow.consultantOnboardingAnswers.findByOnboardingId(onboarding.id),
    ]);

    const answerByQuestionId = new Map<string, ConsultantOnboardingAnswer>(
      answers.map((a) => [a.onboardingQuestionId, a]),
    );

    const answerViews = questions.map((q: ConsultantOnboardingQuestion) => {
      const a = answerByQuestionId.get(q.id);
      return plainToInstance(
        OnboardingAnswerViewDto,
        {
          onboarding_question_id: q.id,
          question_order: q.questionOrder,
          type: q.type,
          content: q.contentSnapshot,
          answer_text: a?.answerText ?? null,
          submitted_at: a?.submittedAt ? a.submittedAt.toISOString() : null,
        },
        { excludeExtraneousValues: true },
      );
    });

    return plainToInstance(
      OnboardingDetailResponseDto,
      {
        id: onboarding.id,
        user_id: onboarding.userId,
        consultant_email: user?.email ?? '',
        consultant_name: profile?.fullName ?? '',
        bio: profile?.bio ?? null,
        years_of_experience: profile?.yearsOfExperience ?? null,
        phone_number: profile?.phoneNumber ?? null,
        country_code: profile?.countryCode ?? null,
        avatar_url: profile?.avatarUrl ?? null,
        cv_url: profile?.cvUrl ?? null,
        status: onboarding.status,
        decision: onboarding.decision ?? null,
        rejection_note: onboarding.rejectionNote ?? null,
        blocked_until: onboarding.blockedUntil ? onboarding.blockedUntil.toISOString() : null,
        profile_submitted_at: onboarding.profileSubmittedAt
          ? onboarding.profileSubmittedAt.toISOString()
          : null,
        interview_submitted_at: onboarding.interviewSubmittedAt
          ? onboarding.interviewSubmittedAt.toISOString()
          : null,
        reviewed_at: onboarding.reviewedAt ? onboarding.reviewedAt.toISOString() : null,
        reviewed_by: onboarding.reviewedBy ?? null,
        created_at: onboarding.createdAt.toISOString(),
        answers: answerViews,
      },
      { excludeExtraneousValues: true },
    );
  }
}
