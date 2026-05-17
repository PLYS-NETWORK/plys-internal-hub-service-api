import { THROTTLE_DEFAULT } from '@common/constants';
import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PlatformGuard } from '@common/guards/platform.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AiBootstrapService } from './ai-bootstrap.service';
import { AiBootstrapResponseDto } from './dto/responses';

// Single-shot read for the chat panel. Mounted under /projects/:projectId so
// the existing `BusinessAccessService.resolveOwnedProject` can gate the call
// on the project URL segment without a shape change to the access helper.
@ApiTags('AI Bootstrap')
@ApiBearerAuth()
@Controller('projects/:projectId/ai-bootstrap')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.BUSINESS)
@Throttle(THROTTLE_DEFAULT)
export class AiBootstrapController {
  constructor(private readonly service: AiBootstrapService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aggregate read for the AI chat panel',
    description:
      'Returns project state + AI-context snapshot (or null) + the calling ' +
      "user's sessions + live tasks + project-required skills + the skill " +
      'catalog in one round trip. Cached server-side per request — `live_*` ' +
      'fields are always fresh.',
  })
  public async bootstrap(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<ITranslatedPayload<AiBootstrapResponseDto>> {
    const data = await this.service.bootstrap(projectId);
    return { messageKey: 'success.ok', data };
  }
}
