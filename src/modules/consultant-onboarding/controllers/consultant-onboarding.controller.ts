import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PlatformGuard } from '@common/guards/platform.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { SubmitOnboardingAnswersDto } from '../dto/requests/submit-onboarding-answers.dto';
import { SubmitOnboardingProfileDto } from '../dto/requests/submit-onboarding-profile.dto';
import { OnboardingQuestionResponseDto } from '../dto/responses/onboarding-question-response.dto';
import { OnboardingStatusResponseDto } from '../dto/responses/onboarding-status-response.dto';
import { ConsultantOnboardingService } from '../services/consultant-onboarding.service';
import { OnboardingInterviewService } from '../services/onboarding-interview.service';

@ApiTags('Consultant Onboarding')
@ApiBearerAuth()
@Controller('consultant/onboarding')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.CONSULTANT)
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
