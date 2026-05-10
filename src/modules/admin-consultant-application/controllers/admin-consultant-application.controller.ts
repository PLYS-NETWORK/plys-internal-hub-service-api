import { Roles } from '@common/decorators/roles.decorator';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { UserRole } from '@database/enums';
import { AdminDecideDto } from '@modules/consultant-application/dto/requests/admin-decide.dto';
import { AdminManualScoreDto } from '@modules/consultant-application/dto/requests/admin-manual-score.dto';
import { ListApplicationsDto } from '@modules/consultant-application/dto/requests/list-applications.dto';
import {
  ApplicationDetailResponseDto,
  InterviewQuestionResponseDto,
  IPaginatedApplicationsResponse,
} from '@modules/consultant-application/dto/responses';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminApplicationService } from '../services/admin-application.service';
import { AdminEvaluationService } from '../services/admin-evaluation.service';

@ApiTags('Admin — Consultant Applications')
@ApiBearerAuth()
@Controller('admin/consultant-applications')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN_PLATFORM)
export class AdminConsultantApplicationController {
  constructor(
    private readonly applicationService: AdminApplicationService,
    private readonly adminEvaluationService: AdminEvaluationService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List consultant applications with optional filters' })
  public async list(
    @Query() dto: ListApplicationsDto,
  ): Promise<ITranslatedPayload<IPaginatedApplicationsResponse>> {
    const data = await this.applicationService.listApplications(dto);
    return { messageKey: 'success.ok', data };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get full application detail including all Q&As and scores' })
  public async getDetail(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<ApplicationDetailResponseDto>> {
    const data = await this.applicationService.getApplicationDetail(id);
    return { messageKey: 'success.ok', data };
  }

  @Post(':id/start-evaluation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger the evaluation pipeline for a submitted interview' })
  public async startEvaluation(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<null>> {
    await this.applicationService.startEvaluation(id);
    return { messageKey: 'success.consultant_application.evaluation_started', data: null };
  }

  @Get(':id/manual-questions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get COMMUNICATION + SYSTEM_KNOWLEDGE Q&As for manual scoring' })
  public async getManualQuestions(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<InterviewQuestionResponseDto[]>> {
    const data = await this.adminEvaluationService.getManualQuestions(id);
    return { messageKey: 'success.ok', data };
  }

  @Patch(':id/manual-evaluation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit manual scores for COMMUNICATION and SYSTEM_KNOWLEDGE answers' })
  public async submitManualEvaluation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminManualScoreDto,
  ): Promise<ITranslatedPayload<null>> {
    await this.adminEvaluationService.submitManualEvaluation(id, dto);
    return {
      messageKey: 'success.consultant_application.manual_evaluation_submitted',
      data: null,
    };
  }

  @Post(':id/decide')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Make the final approval or rejection decision' })
  public async decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminDecideDto,
  ): Promise<ITranslatedPayload<null>> {
    await this.applicationService.makeDecision(id, dto);
    return { messageKey: 'success.consultant_application.decision_made', data: null };
  }
}
