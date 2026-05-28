import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { AiBootstrapService } from './ai-bootstrap.service';
import { AiBootstrapResponseDto } from './dto/responses';
// Single-shot read for the chat panel. Mounted under /projects/:projectId so
// the existing `BusinessAccessService.resolveOwnedProject` can gate the call
// on the project URL segment without a shape change to the access helper.
@Controller('projects/:projectId/ai-bootstrap')
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
