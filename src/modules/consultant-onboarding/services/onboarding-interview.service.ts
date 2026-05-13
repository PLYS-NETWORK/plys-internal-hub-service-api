import { ERROR_CODES } from '@common/constants/error-codes';
import { NOTIFICATION_EVENTS } from '@common/events';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EmailService } from '@common/modules/email/email.service';
import { EnvironmentsService } from '@common/modules/environments';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ConsultantOnboarding } from '@database/entities';
import { OnboardingStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';

import { SubmitOnboardingAnswerDto } from '../dto/requests/submit-onboarding-answer.dto';
import { OnboardingQuestionResponseDto } from '../dto/responses/onboarding-question-response.dto';
import { IOnboardingInterviewService } from '../interfaces/onboarding-interview.service.interface';

const TOTAL_ONBOARDING_QUESTIONS = 10;

@Injectable()
export class OnboardingInterviewService implements IOnboardingInterviewService {
  private readonly logger: AppLogger;

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly emailService: EmailService,
    private readonly env: EnvironmentsService,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger = new AppLogger(OnboardingInterviewService.name, requestContext);
  }

  /** @inheritdoc */
  public async getQuestions(): Promise<OnboardingQuestionResponseDto[]> {
    const userId = this.requestContext.userId!;
    this.logger.log(`[${this.rid}] getQuestions — start | userId: ${userId}`);

    const onboarding = await this.loadOnboarding(userId);
    this.assertInInterview(onboarding.status);

    const questions = await this.uow.consultantOnboardingQuestions.findByOnboardingId(
      onboarding.id,
    );
    const answers = await this.uow.consultantOnboardingAnswers.findByOnboardingId(onboarding.id);
    const answerByQuestionId = new Map(answers.map((a) => [a.onboardingQuestionId, a.answerText]));

    return questions.map((q) =>
      plainToInstance(
        OnboardingQuestionResponseDto,
        {
          id: q.id,
          onboarding_question_id: q.id,
          question_order: q.questionOrder,
          type: q.type,
          content: q.contentSnapshot,
          answer_text: answerByQuestionId.get(q.id) ?? null,
        },
        { excludeExtraneousValues: true },
      ),
    );
  }

  /** @inheritdoc */
  public async submitAnswer(dto: SubmitOnboardingAnswerDto): Promise<void> {
    const userId = this.requestContext.userId!;
    this.logger.log(
      `[${this.rid}] submitAnswer — start | userId: ${userId} | questionId: ${dto.onboarding_question_id}`,
    );

    await this.uow.withTransaction(async (tx) => {
      const onboarding = await tx.consultantOnboardings.findByUserId(userId);
      if (!onboarding) {
        throw new TranslatableException({
          messageKey: 'error.consultant_onboarding.not_found',
          errorCode: ERROR_CODES.CONSULTANT_ONBOARDING_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }
      this.assertInInterview(onboarding.status);

      // Verify the question belongs to this onboarding before upserting the answer.
      const question = await tx.consultantOnboardingQuestions.findById(dto.onboarding_question_id);
      if (!question || question.onboardingId !== onboarding.id) {
        this.logger.warn(
          `[${this.rid}] submitAnswer — question not found or foreign | questionId: ${dto.onboarding_question_id}`,
        );
        throw new TranslatableException({
          messageKey: 'error.consultant_onboarding.not_found',
          errorCode: ERROR_CODES.CONSULTANT_ONBOARDING_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }

      const existing = await tx.consultantOnboardingAnswers.findOne({
        where: { onboardingQuestionId: dto.onboarding_question_id },
      });
      const now = new Date();
      if (existing) {
        existing.answerText = dto.answer_text;
        existing.submittedAt = now;
        await tx.consultantOnboardingAnswers.save(existing);
      } else {
        const row = tx.consultantOnboardingAnswers.create({
          onboardingQuestionId: dto.onboarding_question_id,
          answerText: dto.answer_text,
          submittedAt: now,
        });
        await tx.consultantOnboardingAnswers.save(row);
      }
    });

    this.logger.log(`[${this.rid}] submitAnswer — complete | userId: ${userId}`);
  }

  /** @inheritdoc */
  public async submit(): Promise<void> {
    const userId = this.requestContext.userId!;
    this.logger.log(`[${this.rid}] submit — start | userId: ${userId}`);

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

      const answers = await tx.consultantOnboardingAnswers.findByOnboardingId(onboarding.id);
      if (answers.length < TOTAL_ONBOARDING_QUESTIONS) {
        this.logger.warn(
          `[${this.rid}] submit — incomplete answers | onboardingId: ${onboarding.id} | answered: ${answers.length}`,
        );
        throw new TranslatableException({
          messageKey: 'error.consultant_onboarding.incomplete_answers',
          errorCode: ERROR_CODES.CONSULTANT_ONBOARDING_INCOMPLETE_ANSWERS,
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          details: { answered: answers.length, required: TOTAL_ONBOARDING_QUESTIONS },
        });
      }

      onboarding.status = OnboardingStatus.INTERVIEW_SUBMITTED;
      onboarding.interviewSubmittedAt = new Date();
      await tx.consultantOnboardings.save(onboarding);

      const profile = await tx.consultantProfiles.findByUserId(userId);
      const user = await tx.users.findById(userId);
      return {
        onboardingId: onboarding.id,
        consultantName: profile?.fullName ?? 'Consultant',
        consultantEmail: user?.email ?? null,
      };
    });

    // Email + admin broadcast happen outside the transaction (best-effort, non-blocking).
    await this.notifyConsultantAndAdmins(result);

    this.logger.log(
      `[${this.rid}] submit — complete | onboardingId: ${result.onboardingId} | userId: ${userId}`,
    );
  }

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

  private async notifyConsultantAndAdmins(result: {
    onboardingId: string;
    consultantName: string;
    consultantEmail: string | null;
  }): Promise<void> {
    // Consultant "we received your submission" email.
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

    // Admin broadcast (first admin TO, rest CC — handled inside email service).
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

    // NOTE: in-app notification for the consultant on INTERVIEW_SUBMITTED is
    // intentionally NOT emitted — the user's notification plan covers ONBOARDING_APPROVED
    // (the admin's eventual decision), not the submitted state. Add a CONSULTANT_INTERVIEW_SUBMITTED
    // event here if that requirement evolves.
    void NOTIFICATION_EVENTS; // referenced for type import path stability
  }
}
