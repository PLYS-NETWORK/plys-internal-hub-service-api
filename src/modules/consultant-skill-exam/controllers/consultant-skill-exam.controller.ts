import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PlatformGuard } from '@common/guards/platform.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { StartSkillExamDto } from '../dto/requests/start-skill-exam.dto';
import { SubmitSkillExamAnswerDto } from '../dto/requests/submit-skill-exam-answer.dto';
import { SkillExamDetailResponseDto } from '../dto/responses/skill-exam-detail-response.dto';
import { SkillExamSummaryResponseDto } from '../dto/responses/skill-exam-summary-response.dto';
import { NotBannedGuard } from '../guards/not-banned.guard';
import { OnboardingApprovedGuard } from '../guards/onboarding-approved.guard';
import { ConsultantSkillExamService } from '../services/consultant-skill-exam.service';

@ApiTags('Consultant Skill Exams')
@ApiBearerAuth()
@Controller('consultant/skill-exams')
@UseGuards(RolesGuard, PlatformGuard, NotBannedGuard, OnboardingApprovedGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.CONSULTANT)
export class ConsultantSkillExamController {
  constructor(private readonly service: ConsultantSkillExamService) {}

  @Get()
  @ApiOperation({ summary: 'List the caller’s skill exams (all attempts, newest first)' })
  public async listMine(): Promise<ITranslatedPayload<SkillExamSummaryResponseDto[]>> {
    const data = await this.service.listMine();
    return { messageKey: 'success.ok', data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Start a new skill exam — enqueues AI question generation (status: GENERATING_QUESTIONS).',
  })
  public async start(
    @Body() dto: StartSkillExamDto,
  ): Promise<ITranslatedPayload<SkillExamSummaryResponseDto>> {
    const data = await this.service.start(dto);
    return { messageKey: 'success.skill_exam.started', data };
  }

  @Get(':examId')
  @ApiOperation({ summary: 'Skill exam detail (questions + saved answers)' })
  public async getDetail(
    @Param('examId', ParseUUIDPipe) examId: string,
  ): Promise<ITranslatedPayload<SkillExamDetailResponseDto>> {
    const data = await this.service.getDetail(examId);
    return { messageKey: 'success.ok', data };
  }

  @Post(':examId/answers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upsert a single skill-exam answer (idempotent)' })
  public async submitAnswer(
    @Param('examId', ParseUUIDPipe) examId: string,
    @Body() dto: SubmitSkillExamAnswerDto,
  ): Promise<ITranslatedPayload<null>> {
    await this.service.submitAnswer(examId, dto);
    return { messageKey: 'success.skill_exam.answer_saved', data: null };
  }

  @Post(':examId/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Finalise the skill exam (requires all 20 answers) — enqueues Copyleaks then AI eval.',
  })
  public async submit(
    @Param('examId', ParseUUIDPipe) examId: string,
  ): Promise<ITranslatedPayload<null>> {
    await this.service.submit(examId);
    return { messageKey: 'success.skill_exam.submitted', data: null };
  }
}
