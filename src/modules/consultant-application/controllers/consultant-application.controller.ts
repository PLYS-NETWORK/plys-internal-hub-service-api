import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PlatformGuard } from '@common/guards/platform.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { SubmitAnswerDto, SubmitProfileDto } from '../dto/requests';
import { ApplicationStatusResponseDto, InterviewQuestionResponseDto } from '../dto/responses';
import { ConsultantApplicationService } from '../services/consultant-application.service';
import { InterviewService } from '../services/interview.service';

@ApiTags('Consultant Application')
@ApiBearerAuth()
@Controller('consultant/application')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.CONSULTANT)
export class ConsultantApplicationController {
  constructor(
    private readonly applicationService: ConsultantApplicationService,
    private readonly interviewService: InterviewService,
  ) {}

  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get my current application status' })
  public async getStatus(): Promise<ITranslatedPayload<ApplicationStatusResponseDto | null>> {
    const data = await this.applicationService.getMyApplicationStatus();
    return { messageKey: 'success.ok', data };
  }

  @Post('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit or update profile information to start the vetting process' })
  public async submitProfile(
    @Body() dto: SubmitProfileDto,
  ): Promise<ITranslatedPayload<ApplicationStatusResponseDto>> {
    const data = await this.applicationService.submitProfile(dto);
    return { messageKey: 'success.consultant_application.profile_submitted', data };
  }

  @Get('interview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get the 30 assigned interview questions' })
  public async getInterviewQuestions(): Promise<
    ITranslatedPayload<InterviewQuestionResponseDto[]>
  > {
    const data = await this.interviewService.getInterviewQuestions();
    return { messageKey: 'success.ok', data };
  }

  @Post('interview/answers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save or update an answer to a single interview question' })
  public async submitAnswer(@Body() dto: SubmitAnswerDto): Promise<ITranslatedPayload<null>> {
    await this.interviewService.submitAnswer(dto);
    return { messageKey: 'success.consultant_application.answer_submitted', data: null };
  }

  @Post('interview/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Finalise the interview — all 30 answers must be present' })
  public async finalizeInterview(): Promise<ITranslatedPayload<null>> {
    await this.interviewService.finalizeInterview();
    return { messageKey: 'success.consultant_application.interview_submitted', data: null };
  }
}
