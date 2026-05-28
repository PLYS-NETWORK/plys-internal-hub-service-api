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
import { AiBootstrapResponseDto } from '@plys/libraries/api-contracts/ai-bootstrap/dto/responses';
import { THROTTLE_DEFAULT } from '@plys/libraries/common-nest/constants';
import { Platform } from '@plys/libraries/common-nest/decorators/platform.decorator';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { PlatformGuard } from '@plys/libraries/common-nest/guards/platform.guard';
import { RolesGuard } from '@plys/libraries/common-nest/guards/roles.guard';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@plys/libraries/database/enums';

import { AiBootstrapService } from '@/http/v1/shared/grpc-service-tokens';

// Single-shot read for the chat panel. Mounted under /projects/:projectId so
// the existing `BusinessAccessService.resolveOwnedProject` can gate the call
// on the project URL segment without a shape change to the access helper.
@ApiTags('AI Bootstrap')
@ApiBearerAuth()
@Controller('ai-provider/projects/:projectId/ai-bootstrap')
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
