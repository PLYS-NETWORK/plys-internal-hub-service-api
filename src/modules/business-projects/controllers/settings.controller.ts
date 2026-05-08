import { IdempotencyKey } from '@common/decorators/idempotency-key.decorator';
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
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UpdateProjectSettingsDto } from '../dto/requests';
import { ProjectSettingsResponseDto, ProjectSummaryResponseDto } from '../dto/responses';
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
