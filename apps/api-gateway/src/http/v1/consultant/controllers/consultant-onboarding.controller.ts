import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SubmitOnboardingAnswersDto } from '@plys/libraries/api-contracts/consultant-onboarding/dto/requests/submit-onboarding-answers.dto';
import { SubmitOnboardingProfileDto } from '@plys/libraries/api-contracts/consultant-onboarding/dto/requests/submit-onboarding-profile.dto';
import { OnboardingQuestionResponseDto } from '@plys/libraries/api-contracts/consultant-onboarding/dto/responses/onboarding-question-response.dto';
import { OnboardingStatusResponseDto } from '@plys/libraries/api-contracts/consultant-onboarding/dto/responses/onboarding-status-response.dto';
import { THROTTLE_DEFAULT, THROTTLE_MODERATE } from '@plys/libraries/common-nest/constants';
import { Platform } from '@plys/libraries/common-nest/decorators/platform.decorator';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { PlatformGuard } from '@plys/libraries/common-nest/guards/platform.guard';
import { RolesGuard } from '@plys/libraries/common-nest/guards/roles.guard';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@plys/libraries/database/enums';

import {
  ConsultantOnboardingService,
  OnboardingInterviewService,
} from '@/http/v1/shared/grpc-service-tokens';

@ApiTags('Consultant Onboarding')
@ApiBearerAuth()
@Controller('consultant/onboarding')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.CONSULTANT)
@Throttle(THROTTLE_DEFAULT)
export class ConsultantOnboardingController {
  constructor(
    private readonly onboardingService: ConsultantOnboardingService,
    private readonly interviewService: OnboardingInterviewService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Get current onboarding status (null when not started)' })
  public async getStatus(): Promise<ITranslatedPayload<OnboardingStatusResponseDto | null>> {
    const data = await this.onboardingService.getStatus();
    return { messageKey: 'success.ok', data };
  }

  @Post('profile')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(THROTTLE_MODERATE)
  @ApiOperation({
    summary:
      'Step 1 — submit basic profile (+ optional cv_url from a prior /files upload). Transitions onboarding to IN_INTERVIEW.',
  })
  public async submitProfile(
    @Body() dto: SubmitOnboardingProfileDto,
  ): Promise<ITranslatedPayload<OnboardingStatusResponseDto>> {
    const data = await this.onboardingService.submitProfile(dto);
    return { messageKey: 'success.consultant_onboarding.profile_submitted', data };
  }

  @Get('questions')
  @ApiOperation({
    summary: 'Step 2 — list the current set of active onboarding questions, ordered by position.',
  })
  public async getQuestions(): Promise<ITranslatedPayload<OnboardingQuestionResponseDto[]>> {
    const data = await this.interviewService.getQuestions();
    return { messageKey: 'success.ok', data };
  }

  @Post('interview/submit')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE_MODERATE)
  @ApiOperation({
    summary:
      'Step 2 — submit ALL answers in one shot. Body must contain one entry per active question. Notifies admins on success.',
  })
  public async submitInterview(
    @Body() dto: SubmitOnboardingAnswersDto,
  ): Promise<ITranslatedPayload<null>> {
    await this.interviewService.submitAnswers(dto);
    return { messageKey: 'success.consultant_onboarding.interview_submitted', data: null };
  }
}
