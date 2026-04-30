import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PlatformGuard } from '@common/guards/platform.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  UpdateInterviewQuestionDto,
  UpdateProjectSettingsDto,
  UpsertInterviewQuestionDto,
} from '../dto/requests';
import {
  InterviewQuestionResponseDto,
  ProjectSettingsResponseDto,
  ProjectSummaryResponseDto,
} from '../dto/responses';
import { SettingsService } from '../services/settings.service';

@ApiTags('Business Projects — Settings')
@ApiBearerAuth()
@Controller('projects/business/:id/settings')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.BUSINESS)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Get project settings (title, introduction, required_skills, max_consultants, active interview_questions)',
  })
  public async getSettings(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<ProjectSettingsResponseDto>> {
    const data = await this.settingsService.getSettings(id);
    return { messageKey: 'success.ok', data };
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update project metadata (title, introduction, skills, max_consultants)',
  })
  public async updateProject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectSettingsDto,
  ): Promise<ITranslatedPayload<ProjectSummaryResponseDto>> {
    const data = await this.settingsService.updateProject(id, dto);
    return { messageKey: 'success.project.updated', data };
  }

  @Post('interview-questions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new interview question' })
  public async createQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertInterviewQuestionDto,
  ): Promise<ITranslatedPayload<InterviewQuestionResponseDto>> {
    const data = await this.settingsService.createQuestion(id, dto);
    return { messageKey: 'success.created', data };
  }

  @Patch('interview-questions/:qid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an existing interview question' })
  public async updateQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('qid', ParseUUIDPipe) qid: string,
    @Body() dto: UpdateInterviewQuestionDto,
  ): Promise<ITranslatedPayload<InterviewQuestionResponseDto>> {
    const data = await this.settingsService.updateQuestion(id, qid, dto);
    return { messageKey: 'success.ok', data };
  }

  @Delete('interview-questions/:qid')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an interview question (preserves application audit)' })
  public async deleteQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('qid', ParseUUIDPipe) qid: string,
  ): Promise<void> {
    await this.settingsService.deleteQuestion(id, qid);
  }
}
