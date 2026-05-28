import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  LogDecisionDto,
  UpdateDerivedContextDto,
} from '@plys/libraries/api-contracts/project-ai-context/dto/requests';
import { AiContextResponseDto } from '@plys/libraries/api-contracts/project-ai-context/dto/responses';
import { THROTTLE_DEFAULT } from '@plys/libraries/common-nest/constants';
import { IdempotencyKey } from '@plys/libraries/common-nest/decorators/idempotency-key.decorator';
import { Platform } from '@plys/libraries/common-nest/decorators/platform.decorator';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { PlatformGuard } from '@plys/libraries/common-nest/guards/platform.guard';
import { RolesGuard } from '@plys/libraries/common-nest/guards/roles.guard';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@plys/libraries/database/enums';

import { ProjectAiContextService } from '@/http/v1/shared/grpc-service-tokens';

// Project-scoped writes. Both endpoints require business ownership of the
// target project — the service calls `BusinessAccessService.resolveOwnedProject`
// before mutating, so a tampered `projectId` from a different tenant returns
// 404 (PROJECT_NOT_FOUND) without leaking existence.
@ApiTags('AI Context')
@ApiBearerAuth()
@Controller('ai-provider/projects/:projectId/ai-context')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.BUSINESS)
@Throttle(THROTTLE_DEFAULT)
export class ProjectAiContextController {
  constructor(private readonly service: ProjectAiContextService) {}

  @Post('decisions')
  @IdempotencyKey()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Append an audit decision to project_ai_context.decisions',
    description:
      'Free-form audit note the FE writes when a user makes a non-trivial ' +
      'choice during planning / refinement / extension. Append-only — never ' +
      'trimmed or edited; the BE never reads these back.',
  })
  public async logDecision(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: LogDecisionDto,
  ): Promise<ITranslatedPayload<AiContextResponseDto>> {
    const data = await this.service.logDecision(projectId, dto);
    return { messageKey: 'success.ok', data };
  }

  @Patch('derived')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Merge FE-derived AI fields back into the context row',
    description:
      'Called by the FE after it (re-)derives `domain`, `conventions`, ' +
      'per-mode summaries, and per-task summaries. Merges, appends a ' +
      '`derived_write` audit row, clears `needs_reindex`, and stamps ' +
      '`last_indexed_at`.',
  })
  public async updateDerived(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateDerivedContextDto,
  ): Promise<ITranslatedPayload<AiContextResponseDto>> {
    const data = await this.service.updateDerived(projectId, dto);
    return { messageKey: 'success.ok', data };
  }
}
