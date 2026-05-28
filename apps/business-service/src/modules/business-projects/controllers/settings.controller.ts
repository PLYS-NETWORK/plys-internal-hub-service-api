import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { IdempotencyKey } from '@plys/libraries/common-nest/decorators/idempotency-key.decorator';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { UpdateProjectSettingsDto } from '../dto/requests';
import { ProjectSettingsResponseDto, ProjectSummaryResponseDto } from '../dto/responses';
import { SettingsService } from '../services/settings.service';
@Controller('projects/business/:id/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get project settings (title, introduction, required_skills, max_consultants)',
  })
  public async getSettings(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<ProjectSettingsResponseDto>> {
    const data = await this.settingsService.getSettings(id);
    return { messageKey: 'success.ok', data };
  }
  @Patch()
  @IdempotencyKey()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update project metadata (title, introduction, skills, max_consultants)',
    description:
      'Side effect: may auto-transition the project between `draft` ↔ `configured` based on draft-tasks / required-skills / required_consultants completeness (all three must be > 0 to reach `configured`).',
  })
  public async updateProject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectSettingsDto,
  ): Promise<ITranslatedPayload<ProjectSummaryResponseDto>> {
    const data = await this.settingsService.updateProject(id, dto);
    return { messageKey: 'success.project.updated', data };
  }
}
