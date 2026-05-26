import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE_DEFAULT } from '@plys/libraries/common-nest/constants';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { UserRole } from '@plys/libraries/database/enums';

import { AiContextResponseDto } from './dto/responses';
import { ProjectAiContextService } from './project-ai-context.service';

// Admin debug — read the full context row for any project, regardless of
// tenant ownership. Used for troubleshooting `derived_write` audits and
// inspecting `task_index` shape. Mounted under /admin to make the elevated
// permission obvious from the URL.
@ApiTags('Admin - AI Context')
@ApiBearerAuth()
@Controller('admin/projects/:projectId/ai-context')
@Roles(UserRole.ADMIN_PLATFORM)
@Throttle(THROTTLE_DEFAULT)
export class ProjectAiContextAdminController {
  constructor(private readonly service: ProjectAiContextService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Read the full project_ai_context row (Admin only)',
    description:
      'Returns every column including the `decisions` audit array. Used for ' +
      'troubleshooting; the user-facing chat panel reads its slice via ' +
      '/projects/:projectId/ai-bootstrap.',
  })
  public async getContext(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<ITranslatedPayload<AiContextResponseDto>> {
    const data = await this.service.getContext(projectId);
    return { messageKey: 'success.ok', data };
  }
}
