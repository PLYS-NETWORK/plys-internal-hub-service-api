import { ERROR_CODES } from '@common/constants/error-codes';
import { NOTIFICATION_EVENTS } from '@common/events';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EmailService } from '@common/modules/email/email.service';
import { EnvironmentsService } from '@common/modules/environments';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ConsultantApplicationAnswer } from '@database/entities';
import { ApplicationStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';

import { TOTAL_QUESTIONS } from '../consultant-application.constants';
import { SubmitAnswerDto } from '../dto/requests/submit-answer.dto';
import { InterviewQuestionResponseDto } from '../dto/responses/interview-question-response.dto';
import { IInterviewService } from '../interfaces/interview.service.interface';

@Injectable()
export class InterviewService implements IInterviewService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly emailService: EmailService,
    private readonly envService: EnvironmentsService,
    private readonly requestContext: RequestContextService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger = new AppLogger(InterviewService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async getInterviewQuestions(): Promise<InterviewQuestionResponseDto[]> {
    const userId = this.requestContext.userId!;
    this.logger.log(`[${this.rid}] getInterviewQuestions — start | userId: ${userId}`);

    const application = await this.uow.consultantApplications.findActiveByUserId(userId);
    if (!application) {
      throw new TranslatableException({
        messageKey: 'error.consultant_application.not_found',
        errorCode: ERROR_CODES.CONSULTANT_APPLICATION_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    if (application.status !== ApplicationStatus.IN_INTERVIEW) {
      throw new TranslatableException({
        messageKey: 'error.consultant_application.interview_not_ready',
        errorCode: ERROR_CODES.CONSULTANT_APPLICATION_INTERVIEW_NOT_READY,
        status: HttpStatus.CONFLICT,
      });
    }

    const assignedQuestions = await this.uow.applicationQuestions.findByApplicationId(
      application.id,
    );
    const answers = await this.uow.applicationAnswers.findByApplicationId(application.id);
    const answerMap = new Map(answers.map((a) => [a.applicationQuestion?.id ?? '', a]));

    const dtos = assignedQuestions.map((aq) => {
      const answer = answerMap.get(aq.id);
      return plainToInstance(
        InterviewQuestionResponseDto,
        {
          id: aq.id,
          application_question_id: aq.id,
          question_order: aq.questionOrder,
          type: aq.type,
          content: aq.contentSnapshot,
          answer_text: answer?.answerText ?? null,
        },
        { excludeExtraneousValues: true },
      );
    });

    this.logger.log(
      `[${this.rid}] getInterviewQuestions — complete | userId: ${userId}, count: ${dtos.length}`,
    );

    return dtos;
  }

  /** @inheritdoc */
  public async submitAnswer(dto: SubmitAnswerDto): Promise<void> {
    const userId = this.requestContext.userId!;
    this.logger.log(`[${this.rid}] submitAnswer — start | userId: ${userId}`);

    await this.uow.withTransaction(async (tx) => {
      const application = await tx.consultantApplications.findActiveByUserId(userId);
      if (!application) {
        throw new TranslatableException({
          messageKey: 'error.consultant_application.not_found',
          errorCode: ERROR_CODES.CONSULTANT_APPLICATION_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }

      if (application.status !== ApplicationStatus.IN_INTERVIEW) {
        throw new TranslatableException({
          messageKey: 'error.consultant_application.interview_not_ready',
          errorCode: ERROR_CODES.CONSULTANT_APPLICATION_INTERVIEW_NOT_READY,
          status: HttpStatus.CONFLICT,
        });
      }

      // Verify the applicationQuestion belongs to this application
      const assignedQuestion = await tx.applicationQuestions.findOne({
        where: { id: dto.applicationQuestionId, applicationId: application.id },
      });

      if (!assignedQuestion) {
        throw new TranslatableException({
          messageKey: 'error.consultant_application.not_found',
          errorCode: ERROR_CODES.CONSULTANT_APPLICATION_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }

      // Upsert answer
      const existing = await tx.applicationAnswers.findOne({
        where: { applicationQuestionId: dto.applicationQuestionId },
      });

      if (existing) {
        existing.answerText = dto.answerText;
        existing.submittedAt = new Date();
        await tx.applicationAnswers.save(existing);
      } else {
        const answer = tx.applicationAnswers.create({
          applicationQuestionId: dto.applicationQuestionId,
          answerText: dto.answerText,
          submittedAt: new Date(),
        }) as ConsultantApplicationAnswer;
        await tx.applicationAnswers.save(answer);
      }
    });

    this.logger.log(`[${this.rid}] submitAnswer — complete | userId: ${userId}`);
  }

  /** @inheritdoc */
  public async finalizeInterview(): Promise<void> {
    const userId = this.requestContext.userId!;
    this.logger.log(`[${this.rid}] finalizeInterview — start | userId: ${userId}`);

    const { application, consultantEmail, consultantName } = await this.uow.withTransaction(
      async (tx) => {
        const app = await tx.consultantApplications.findActiveByUserId(userId);
        if (!app) {
          throw new TranslatableException({
            messageKey: 'error.consultant_application.not_found',
            errorCode: ERROR_CODES.CONSULTANT_APPLICATION_NOT_FOUND,
            status: HttpStatus.NOT_FOUND,
          });
        }

        if (app.status !== ApplicationStatus.IN_INTERVIEW) {
          throw new TranslatableException({
            messageKey: 'error.consultant_application.interview_not_ready',
            errorCode: ERROR_CODES.CONSULTANT_APPLICATION_INTERVIEW_NOT_READY,
            status: HttpStatus.CONFLICT,
          });
        }

        const answerCount = await tx.applicationAnswers.countByApplicationId(app.id);
        if (answerCount < TOTAL_QUESTIONS) {
          this.logger.warn(
            `[${this.rid}] finalizeInterview — incomplete | userId: ${userId}, answered: ${answerCount}/${TOTAL_QUESTIONS}`,
          );
          throw new TranslatableException({
            messageKey: 'error.consultant_application.incomplete_answers',
            errorCode: ERROR_CODES.CONSULTANT_APPLICATION_INCOMPLETE_ANSWERS,
            status: HttpStatus.UNPROCESSABLE_ENTITY,
            details: { answered: answerCount, required: TOTAL_QUESTIONS },
          });
        }

        app.status = ApplicationStatus.INTERVIEW_SUBMITTED;
        app.interviewSubmittedAt = new Date();
        await tx.consultantApplications.save(app);

        const user = await tx.users.findOne({ where: { id: userId } });
        const profile = await tx.consultantProfiles.findByUserId(userId);

        return {
          application: app,
          consultantEmail: user?.email ?? '',
          consultantName: profile?.fullName ?? user?.email ?? '',
        };
      },
    );

    this.logger.log(
      `[${this.rid}] finalizeInterview — status set INTERVIEW_SUBMITTED | userId: ${userId}`,
    );

    this.eventEmitter.emit(NOTIFICATION_EVENTS.CONSULTANT_INTERVIEW_SUBMITTED, {
      application_id: application.id,
      consultant_user_id: userId,
      consultant_name: consultantName,
    });

    // Send confirmation email to consultant
    void this.emailService
      .sendApplicationSubmittedEmail(consultantEmail, { userName: consultantName })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `[${this.rid}] finalizeInterview — consultant email failed | error: ${msg}`,
        );
      });

    // Notify all active admins
    void this.notifyAdmins(application.id, consultantName, consultantEmail).catch(
      (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `[${this.rid}] finalizeInterview — admin notification failed | error: ${msg}`,
        );
      },
    );

    this.logger.log(`[${this.rid}] finalizeInterview — complete | userId: ${userId}`);
  }

  private async notifyAdmins(
    applicationId: string,
    consultantName: string,
    consultantEmail: string,
  ): Promise<void> {
    const activeAdmins = await this.uow.adminAllowedEmails.find({ where: { isActive: true } });

    const adminEmails = activeAdmins.map((a) => a.email);
    if (adminEmails.length === 0) {
      this.logger.warn(
        `[${this.rid}] notifyAdmins — no active admin emails found | applicationId: ${applicationId}`,
      );
      return;
    }

    const reviewUrl = `${this.envService.internalHubUrl}/consultant-applications/${applicationId}`;

    await this.emailService.sendAdminNewApplicationEmail(adminEmails, {
      consultantName,
      consultantEmail,
      submittedAt: new Date().toISOString(),
      reviewUrl,
    });
  }
}
