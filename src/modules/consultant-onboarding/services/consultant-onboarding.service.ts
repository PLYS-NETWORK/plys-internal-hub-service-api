import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ConsultantOnboarding, InterviewQuestion } from '@database/entities';
import { OnboardingStatus, QuestionType } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { SubmitOnboardingProfileDto } from '../dto/requests/submit-onboarding-profile.dto';
import { OnboardingStatusResponseDto } from '../dto/responses/onboarding-status-response.dto';
import { IConsultantOnboardingService } from '../interfaces/consultant-onboarding.service.interface';

const COMMUNICATION_QUESTION_COUNT = 5;
const SYSTEM_KNOWLEDGE_QUESTION_COUNT = 5;

@Injectable()
export class ConsultantOnboardingService implements IConsultantOnboardingService {
  private readonly logger: AppLogger;

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(ConsultantOnboardingService.name, requestContext);
  }

  /** @inheritdoc */
  public async getStatus(): Promise<OnboardingStatusResponseDto | null> {
    const userId = this.requestContext.userId!;
    this.logger.log(`[${this.rid}] getStatus — start | userId: ${userId}`);

    const onboarding = await this.uow.consultantOnboardings.findByUserId(userId);
    if (!onboarding) {
      this.logger.log(`[${this.rid}] getStatus — no onboarding | userId: ${userId}`);
      return null;
    }

    return this.toResponseDto(onboarding);
  }

  /** @inheritdoc */
  public async submitProfile(
    dto: SubmitOnboardingProfileDto,
  ): Promise<OnboardingStatusResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`[${this.rid}] submitProfile — start | userId: ${userId}`);

    return this.uow.withTransaction(async (tx) => {
      // 1. Block check + status guard
      const existing = await tx.consultantOnboardings.findByUserId(userId);
      if (existing?.blockedUntil && existing.blockedUntil > new Date()) {
        this.logger.warn(
          `[${this.rid}] submitProfile — blocked | userId: ${userId} | until: ${existing.blockedUntil.toISOString()}`,
        );
        throw new TranslatableException({
          messageKey: 'error.consultant_onboarding.blocked',
          errorCode: ERROR_CODES.CONSULTANT_ONBOARDING_BLOCKED,
          status: HttpStatus.FORBIDDEN,
          details: { blocked_until: existing.blockedUntil.toISOString() },
        });
      }
      if (existing && existing.status !== OnboardingStatus.PENDING_BASIC_INFO) {
        this.logger.warn(
          `[${this.rid}] submitProfile — invalid status | userId: ${userId} | status: ${existing.status}`,
        );
        throw new TranslatableException({
          messageKey: 'error.consultant_onboarding.invalid_status',
          errorCode: ERROR_CODES.CONSULTANT_ONBOARDING_INVALID_STATUS,
          status: HttpStatus.CONFLICT,
        });
      }

      // 2. Update the ConsultantProfile (must already exist — created at registration).
      const profile = await tx.consultantProfiles.findByUserId(userId);
      if (!profile) {
        this.logger.error(
          `[${this.rid}] submitProfile — consultant profile missing | userId: ${userId}`,
        );
        throw new TranslatableException({
          messageKey: 'error.consultant_profile.not_found',
          errorCode: ERROR_CODES.CONSULTANT_PROFILE_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }
      profile.fullName = dto.full_name;
      profile.bio = dto.bio;
      profile.yearsOfExperience = dto.years_of_experience;
      profile.phoneNumber = dto.phone_number;
      profile.countryCode = dto.country_code;
      if (dto.avatar_url !== undefined) profile.avatarUrl = dto.avatar_url;
      if (dto.cv_url !== undefined) profile.cvUrl = dto.cv_url;
      await tx.consultantProfiles.save(profile);

      // 3. Upsert the onboarding row in IN_INTERVIEW state.
      const now = new Date();
      const onboarding =
        existing ??
        (tx.consultantOnboardings.create({
          userId,
          status: OnboardingStatus.PENDING_BASIC_INFO,
        }) as ConsultantOnboarding);
      onboarding.status = OnboardingStatus.IN_INTERVIEW;
      onboarding.profileSubmittedAt = now;
      const saved = (await tx.consultantOnboardings.save(onboarding)) as ConsultantOnboarding;

      // 4. Assign 5 COMMUNICATION + 5 SYSTEM_KNOWLEDGE questions from the seed bank.
      const [communication, systemKnowledge] = await Promise.all([
        tx.interviewQuestions.findRandomActiveByType(
          QuestionType.COMMUNICATION,
          COMMUNICATION_QUESTION_COUNT,
        ),
        tx.interviewQuestions.findRandomActiveByType(
          QuestionType.SYSTEM_KNOWLEDGE,
          SYSTEM_KNOWLEDGE_QUESTION_COUNT,
        ),
      ]);
      if (
        communication.length < COMMUNICATION_QUESTION_COUNT ||
        systemKnowledge.length < SYSTEM_KNOWLEDGE_QUESTION_COUNT
      ) {
        this.logger.error(
          `[${this.rid}] submitProfile — seed bank insufficient | comm: ${communication.length}, sys: ${systemKnowledge.length}`,
        );
        throw new TranslatableException({
          messageKey: 'error.interview_question.not_found',
          errorCode: ERROR_CODES.INTERVIEW_QUESTION_NOT_FOUND,
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        });
      }
      const ordered: InterviewQuestion[] = [...communication, ...systemKnowledge];
      const questionRows = ordered.map((q, idx) =>
        tx.consultantOnboardingQuestions.create({
          onboardingId: saved.id,
          interviewQuestionId: q.id,
          type: q.type,
          contentSnapshot: q.content,
          questionOrder: idx + 1,
        }),
      );
      await tx.consultantOnboardingQuestions.save(questionRows);

      this.logger.log(
        `[${this.rid}] submitProfile — complete | onboardingId: ${saved.id} | userId: ${userId}`,
      );
      return this.toResponseDto(saved);
    });
  }

  private toResponseDto(row: ConsultantOnboarding): OnboardingStatusResponseDto {
    return plainToInstance(
      OnboardingStatusResponseDto,
      {
        id: row.id,
        status: row.status,
        decision: row.decision ?? null,
        rejection_note: row.rejectionNote ?? null,
        blocked_until: row.blockedUntil ? row.blockedUntil.toISOString() : null,
        profile_submitted_at: row.profileSubmittedAt ? row.profileSubmittedAt.toISOString() : null,
        interview_submitted_at: row.interviewSubmittedAt
          ? row.interviewSubmittedAt.toISOString()
          : null,
        reviewed_at: row.reviewedAt ? row.reviewedAt.toISOString() : null,
        created_at: row.createdAt.toISOString(),
      },
      { excludeExtraneousValues: true },
    );
  }
}
