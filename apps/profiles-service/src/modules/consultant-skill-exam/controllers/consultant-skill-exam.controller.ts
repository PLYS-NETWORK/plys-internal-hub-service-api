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
import { Throttle } from '@nestjs/throttler';
import { THROTTLE_DEFAULT, THROTTLE_MODERATE } from '@plys/libraries/common-nest/constants';
import { Platform } from '@plys/libraries/common-nest/decorators/platform.decorator';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { PlatformGuard } from '@plys/libraries/common-nest/guards/platform.guard';
import { RolesGuard } from '@plys/libraries/common-nest/guards/roles.guard';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@plys/libraries/database/enums';

import { StartSkillExamDto } from '../dto/requests/start-skill-exam.dto';
import { SubmitSkillExamAnswerDto } from '../dto/requests/submit-skill-exam-answer.dto';
import { SkillExamDetailResponseDto } from '../dto/responses/skill-exam-detail-response.dto';
import { SkillExamEligibilityResponseDto } from '../dto/responses/skill-exam-eligibility-response.dto';
import { SkillExamSummaryResponseDto } from '../dto/responses/skill-exam-summary-response.dto';
import { ConsultantSkillExamService } from '../services/consultant-skill-exam.service';

@ApiTags('Consultant Skill Exams')
@ApiBearerAuth()
@Controller('consultant/skill-exams')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.CONSULTANT)
@Throttle(THROTTLE_DEFAULT)
export class ConsultantSkillExamController {
  constructor(private readonly service: ConsultantSkillExamService) {}

  @Get('current')
  @ApiOperation({
    summary:
      'Return the consultant’s currently active exam (any non-terminal status, or null when none).',
  })
  public async getCurrent(): Promise<ITranslatedPayload<SkillExamSummaryResponseDto | null>> {
    const data = await this.service.getCurrent();
    return { messageKey: 'success.ok', data };
  }

  @Get('eligibility')
  @ApiOperation({
    summary:
      'Single source of truth for the "Start exam" button: whether the consultant may register a new exam right now.',
  })
  public async getEligibility(): Promise<ITranslatedPayload<SkillExamEligibilityResponseDto>> {
    const data = await this.service.getEligibility();
    return { messageKey: 'success.ok', data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle(THROTTLE_MODERATE)
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
  @Throttle(THROTTLE_MODERATE)
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
  @Throttle(THROTTLE_MODERATE)
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
