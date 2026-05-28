import { HttpStatus, Injectable } from '@nestjs/common';
import {
  IConsultantOnboardingSubmittedEvent,
  NOTIFICATION_EVENTS,
} from '@plys/libraries/common-nest/events';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { EmailService } from '@plys/libraries/common-nest/modules/email/email.service';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { NotificationsClientService } from '@plys/libraries/common-nest/modules/notifications-client/notifications-client.service';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import {
  ConsultantOnboarding,
  IOnboardingQuestionSnapshot,
  OnboardingAnswerValue,
  OnboardingQuestion,
} from '@plys/libraries/database/entities';
import { OnboardingQuestionType, OnboardingStatus } from '@plys/libraries/database/enums';
import { ProfilesUnitOfWorkService } from '@plys/libraries/unit-of-work/profiles-unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { ERROR_CODES } from '../../../errors/error-codes';
import {
  SubmitOnboardingAnswerItemDto,
  SubmitOnboardingAnswersDto,
} from '../dto/requests/submit-onboarding-answers.dto';
import { OnboardingQuestionResponseDto } from '../dto/responses/onboarding-question-response.dto';
import { IOnboardingInterviewService } from '../interfaces/onboarding-interview.service.interface';

@Injectable()
export class OnboardingInterviewService implements IOnboardingInterviewService {
  private readonly logger: AppLogger;

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: ProfilesUnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly emailService: EmailService,
    private readonly env: EnvironmentsService,
    private readonly notificationsClient: NotificationsClientService,
  ) {
    this.logger = new AppLogger(OnboardingInterviewService.name, requestContext);
  }

  /** @inheritdoc */
  public async getQuestions(): Promise<OnboardingQuestionResponseDto[]> {
    const userId = this.requestContext.userId!;
    this.logger.log(`[${this.rid}] getQuestions — start | userId: ${userId}`);

    const onboarding = await this.loadOnboarding(userId);
    this.assertInInterview(onboarding.status);

    const questions = await this.uow.onboardingQuestions.findAllActiveOrdered();
    this.logger.log(
      `[${this.rid}] getQuestions — complete | userId: ${userId} | count: ${questions.length}`,
    );
    return questions.map((q) => this.toQuestionResponseDto(q));
  }

  /** @inheritdoc */
  public async submitAnswers(dto: SubmitOnboardingAnswersDto): Promise<void> {
    const userId = this.requestContext.userId!;
    this.logger.log(
      `[${this.rid}] submitAnswers — start | userId: ${userId} | answers: ${dto.answers.length}`,
    );

    const result = await this.uow.withTransaction(async (tx) => {
      const onboarding = await tx.consultantOnboardings.findByUserId(userId);
      if (!onboarding) {
        throw new TranslatableException({
          messageKey: 'error.consultant_onboarding.not_found',
          errorCode: ERROR_CODES.CONSULTANT_ONBOARDING_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }
      this.assertInInterview(onboarding.status);

      const activeQuestions = await tx.onboardingQuestions.findAllActiveOrdered();
      const questionsById = new Map(activeQuestions.map((q) => [q.id, q]));

      // Coverage: every active question answered exactly once, no foreign ids.
      const answeredIds = new Set<string>();
      for (const a of dto.answers) {
        if (answeredIds.has(a.onboardingQuestionId) || !questionsById.has(a.onboardingQuestionId)) {
          this.logger.warn(
            `[${this.rid}] submitAnswers — coverage mismatch (dup or foreign) | id: ${a.onboardingQuestionId}`,
          );
          throw this.coverageError();
        }
        answeredIds.add(a.onboardingQuestionId);
      }
      if (answeredIds.size !== activeQuestions.length) {
        this.logger.warn(
          `[${this.rid}] submitAnswers — coverage mismatch (size) | expected: ${activeQuestions.length} | got: ${answeredIds.size}`,
        );
        throw this.coverageError();
      }

      // Per-item shape validation + row construction with snapshot.
      const now = new Date();
      const rows = dto.answers.map((a) => {
        const q = questionsById.get(a.onboardingQuestionId)!;
        const value = this.normaliseAndValidateAnswerValue(q, a);
        const snapshot: IOnboardingQuestionSnapshot = {
          type: q.type,
          question: q.question,
          options: q.options ?? null,
        };
        return tx.consultantOnboardingAnswers.create({
          onboardingId: onboarding.id,
          onboardingQuestionId: q.id,
          questionSnapshot: snapshot,
          answerValue: value,
          submittedAt: now,
        });
      });
      await tx.consultantOnboardingAnswers.save(rows);

      onboarding.status = OnboardingStatus.INTERVIEW_SUBMITTED;
      onboarding.interviewSubmittedAt = now;
      await tx.consultantOnboardings.save(onboarding);

      const profile = await tx.consultantProfiles.findByUserId(userId);
      const user = await tx.users.findById(userId);
      return {
        onboardingId: onboarding.id,
        consultantName: profile?.fullName ?? 'Consultant',
        consultantEmail: user?.email ?? null,
      };
    });

    await this.notifyConsultantAndAdmins(result);

    // Fan out an in-app admin notification too — the email broadcast above is
    // best-effort/async, but admins should also see the new pending review in
    // their notification feed instantly. See ADMIN_CONSULTANT_ONBOARDING_SUBMITTED
    // wired in notification-event-handler.service.ts.
    const submittedPayload: IConsultantOnboardingSubmittedEvent = {
      consultant_user_id: userId,
      consultant_name: result.consultantName,
      onboarding_id: result.onboardingId,
    };
    this.notificationsClient.emit(
      NOTIFICATION_EVENTS.CONSULTANT_ONBOARDING_SUBMITTED,
      submittedPayload,
    );

    this.logger.log(
      `[${this.rid}] submitAnswers — complete | onboardingId: ${result.onboardingId} | userId: ${userId}`,
    );
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private assertInInterview(status: OnboardingStatus): void {
    if (status !== OnboardingStatus.IN_INTERVIEW) {
      throw new TranslatableException({
        messageKey: 'error.consultant_onboarding.invalid_status',
        errorCode: ERROR_CODES.CONSULTANT_ONBOARDING_INVALID_STATUS,
        status: HttpStatus.CONFLICT,
      });
    }
  }

  private async loadOnboarding(userId: string): Promise<ConsultantOnboarding> {
    const onboarding = await this.uow.consultantOnboardings.findByUserId(userId);
    if (!onboarding) {
      throw new TranslatableException({
        messageKey: 'error.consultant_onboarding.not_found',
        errorCode: ERROR_CODES.CONSULTANT_ONBOARDING_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }
    return onboarding;
  }

  private coverageError(): TranslatableException {
    return new TranslatableException({
      messageKey: 'error.consultant_onboarding.answers_coverage',
      errorCode: ERROR_CODES.CONSULTANT_ONBOARDING_ANSWERS_COVERAGE,
      status: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  }

  private invalidAnswerError(): TranslatableException {
    return new TranslatableException({
      messageKey: 'error.consultant_onboarding.invalid_answer',
      errorCode: ERROR_CODES.CONSULTANT_ONBOARDING_INVALID_ANSWER,
      status: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  }

  // Validates the incoming answer_value against the question type & options, and
  // returns a normalised value object stored verbatim in jsonb.
  private normaliseAndValidateAnswerValue(
    question: OnboardingQuestion,
    item: SubmitOnboardingAnswerItemDto,
  ): OnboardingAnswerValue {
    const raw = item.answerValue;
    if (question.type === OnboardingQuestionType.TEXT) {
      const text = (raw as { text?: unknown }).text;
      if (typeof text !== 'string' || text.trim().length === 0) {
        throw this.invalidAnswerError();
      }
      return { text };
    }

    if (question.type === OnboardingQuestionType.RADIO) {
      const value = (raw as { value?: unknown }).value;
      const known = new Set((question.options ?? []).map((o) => o.value));
      if (typeof value !== 'string' || !known.has(value)) {
        throw this.invalidAnswerError();
      }
      return { value };
    }

    // CHECKBOX
    const values = (raw as { values?: unknown }).values;
    if (!Array.isArray(values) || values.length === 0) {
      throw this.invalidAnswerError();
    }
    const known = new Set((question.options ?? []).map((o) => o.value));
    const unique = new Set<string>();
    for (const v of values) {
      if (typeof v !== 'string' || !known.has(v) || unique.has(v)) {
        throw this.invalidAnswerError();
      }
      unique.add(v);
    }
    return { values: [...unique] };
  }

  private toQuestionResponseDto(q: OnboardingQuestion): OnboardingQuestionResponseDto {
    return plainToInstance(
      OnboardingQuestionResponseDto,
      {
        id: q.id,
        type: q.type,
        question: q.question,
        options: q.options ?? null,
        position: q.position ?? 0,
      },
      { excludeExtraneousValues: true },
    );
  }

  private async notifyConsultantAndAdmins(result: {
    onboardingId: string;
    consultantName: string;
    consultantEmail: string | null;
  }): Promise<void> {
    if (result.consultantEmail) {
      try {
        await this.emailService.sendApplicationSubmittedEmail(result.consultantEmail, {
          userName: result.consultantName,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[${this.rid}] notify consultant — failed | error: ${msg}`);
      }
    }

    try {
      const adminUserIds = await this.uow.users.findActiveAdminUserIds();
      if (adminUserIds.length === 0) {
        this.logger.warn(`[${this.rid}] notify admins — no active admins`);
        return;
      }
      const admins = await Promise.all(adminUserIds.map((id) => this.uow.users.findById(id)));
      const adminEmails = admins
        .filter((a): a is NonNullable<typeof a> => Boolean(a))
        .map((a) => a.email);
      if (adminEmails.length === 0) return;

      await this.emailService.sendAdminNewApplicationEmail(adminEmails, {
        consultantName: result.consultantName,
        consultantEmail: result.consultantEmail ?? '',
        submittedAt: new Date().toISOString(),
        reviewUrl: `${this.env.internalHubUrl}/consultant-onboardings/${result.onboardingId}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[${this.rid}] notify admins — failed | error: ${msg}`);
    }
  }
}
