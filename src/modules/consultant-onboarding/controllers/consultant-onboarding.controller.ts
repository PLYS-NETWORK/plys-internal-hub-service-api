import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PlatformGuard } from '@common/guards/platform.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { SubmitOnboardingAnswerDto } from '../dto/requests/submit-onboarding-answer.dto';
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
      'Submit basic onboarding profile; advances to IN_INTERVIEW and assigns 10 questions (5 COMMUNICATION + 5 SYSTEM_KNOWLEDGE).',
  })
  public async submitProfile(
    @Body() dto: SubmitOnboardingProfileDto,
  ): Promise<ITranslatedPayload<OnboardingStatusResponseDto>> {
    const data = await this.onboardingService.submitProfile(dto);
    return { messageKey: 'success.consultant_onboarding.profile_submitted', data };
  }

  @Get('interview')
  @ApiOperation({ summary: 'List the 10 onboarding questions with any saved answers' })
  public async getInterviewQuestions(): Promise<
    ITranslatedPayload<OnboardingQuestionResponseDto[]>
  > {
    const data = await this.interviewService.getQuestions();
    return { messageKey: 'success.ok', data };
  }

  @Post('interview/answers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upsert a single onboarding answer (idempotent)' })
  public async submitAnswer(
    @Body() dto: SubmitOnboardingAnswerDto,
  ): Promise<ITranslatedPayload<null>> {
    await this.interviewService.submitAnswer(dto);
    return { messageKey: 'success.consultant_onboarding.answer_saved', data: null };
  }

  @Post('interview/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Finalise the onboarding interview (requires all 10 answers). Notifies admins.',
  })
  public async submitInterview(): Promise<ITranslatedPayload<null>> {
    await this.interviewService.submit();
    return { messageKey: 'success.consultant_onboarding.interview_submitted', data: null };
  }
}
