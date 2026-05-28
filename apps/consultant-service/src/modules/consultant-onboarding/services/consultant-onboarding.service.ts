import { HttpStatus, Injectable } from '@nestjs/common';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { ConsultantOnboarding } from '@plys/libraries/database/entities';
import { OnboardingStatus } from '@plys/libraries/database/enums';
import { ProfilesUnitOfWorkService } from '@plys/libraries/unit-of-work/profiles-unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { ERROR_CODES } from '../../../errors/error-codes';
import { SubmitOnboardingProfileDto } from '../dto/requests/submit-onboarding-profile.dto';
import { OnboardingStatusResponseDto } from '../dto/responses/onboarding-status-response.dto';
import { IConsultantOnboardingService } from '../interfaces/consultant-onboarding.service.interface';

@Injectable()
export class ConsultantOnboardingService implements IConsultantOnboardingService {
  private readonly logger: AppLogger;

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: ProfilesUnitOfWorkService,
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
      // 1. Block check + status guard.
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

      // 3. Upsert the onboarding row into IN_INTERVIEW.
      // Questions are NO LONGER pre-assigned: the consultant sees the global active
      // question set when they fetch /consultant/onboarding/questions, and submits
      // every answer at once via /consultant/onboarding/interview/submit.
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
