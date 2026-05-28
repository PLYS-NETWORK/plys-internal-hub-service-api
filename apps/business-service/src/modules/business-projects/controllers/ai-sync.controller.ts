import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { IdempotencyKey } from '@plys/libraries/common-nest/decorators/idempotency-key.decorator';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { AiSyncSettingsDto } from '../dto/requests/ai-sync-settings.dto';
import { AiSyncSkillsDto } from '../dto/requests/ai-sync-skills.dto';
import { AiSyncTasksDto } from '../dto/requests/ai-sync-tasks.dto';
import { ProjectSummaryResponseDto } from '../dto/responses';
import { AiSyncTasksResponseDto } from '../dto/responses/ai-sync-tasks-response.dto';
import { BacklogsService } from '../services/backlogs.service';
import { SettingsService } from '../services/settings.service';
// Atomic-batch endpoints used by the AI implementation runner. Each call is
// wrapped in a single transaction inside the relevant service method, and
// every endpoint opts into idempotent replay via @IdempotencyKey() so the
// FE's retry logic can hit the same key after a network blip without
// applying the plan twice.
@Controller('projects/business/:id/ai-sync')
export class AiSyncController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly backlogsService: BacklogsService,
  ) {}
  @Post('settings')
  @IdempotencyKey()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'AI-sync atomic settings save (title / introduction / max_consultants)',
    description:
      'Replaces the per-resource PATCH /settings flow for the AI runner. ' +
      'Single transaction; auto-recomputes status (`max_consultants = 0` ' +
      'demotes a configured project back to draft).',
  })
  public async aiSyncSettings(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AiSyncSettingsDto,
  ): Promise<ITranslatedPayload<ProjectSummaryResponseDto>> {
    const data = await this.settingsService.aiSyncSettings(id, dto);
    return { messageKey: 'success.ok', data };
  }
  @Post('skills')
  @IdempotencyKey()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'AI-sync replace-set required skills',
    description:
      'Whatever the FE sends becomes the new full skill list. Flips ' +
      '`needs_reindex=true` so the FE re-derives skill clusters on the next ' +
      'bootstrap. Empty array is allowed — clears all required skills.',
  })
  public async aiSyncSkills(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AiSyncSkillsDto,
  ): Promise<ITranslatedPayload<ProjectSummaryResponseDto>> {
    const data = await this.settingsService.aiSyncSkills(id, dto);
    return { messageKey: 'success.ok', data };
  }
  @Post('tasks')
  @IdempotencyKey()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'AI-sync atomic batch task create / update / delete (≤ 50 rows)',
    description:
      'All-or-nothing batch. Mode-aware: PLANNING/REFINE projects accept ' +
      'every action on draft tasks; EXTEND projects (published / in_progress) ' +
      'accept `create` only. A single offending row fails the whole batch ' +
      'with 422 + `details: { offending_client_temp_ids }`.',
  })
  public async aiSyncTasks(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AiSyncTasksDto,
  ): Promise<ITranslatedPayload<AiSyncTasksResponseDto>> {
    const data = await this.backlogsService.aiSyncTasks(id, dto);
    return { messageKey: 'success.ok', data };
  }
}
