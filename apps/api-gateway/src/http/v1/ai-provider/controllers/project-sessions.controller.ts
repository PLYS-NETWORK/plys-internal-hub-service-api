import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CreateSessionDto } from '@plys/libraries/api-contracts/project-chat-session/dto/requests';
import {
  ChatSessionListItemResponseDto,
  ChatSessionMetaResponseDto,
} from '@plys/libraries/api-contracts/project-chat-session/dto/responses';
import { THROTTLE_INTERACTIVE, THROTTLE_MODERATE } from '@plys/libraries/common-nest/constants';
import { Platform } from '@plys/libraries/common-nest/decorators/platform.decorator';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { PlatformGuard } from '@plys/libraries/common-nest/guards/platform.guard';
import { RolesGuard } from '@plys/libraries/common-nest/guards/roles.guard';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@plys/libraries/database/enums';

import { ProjectChatSessionService } from '@/http/v1/shared/grpc-service-tokens';

// Project-scoped routes — list and create. Reads/writes are scoped to the
// calling business user inside the service via RequestContext.userId; the
// project ownership check happens once at the service entry via
// BusinessAccessService.resolveOwnedProject.
@ApiTags('Project Chat Sessions')
@ApiBearerAuth()
@Controller('ai-provider/projects/:projectId/chat-sessions')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.BUSINESS)
@Throttle(THROTTLE_INTERACTIVE)
export class ProjectSessionsController {
  constructor(private readonly service: ProjectChatSessionService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "List the calling user's chat sessions on a project (newest first)",
  })
  public async listProjectSessions(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<ITranslatedPayload<ChatSessionListItemResponseDto[]>> {
    const data = await this.service.listProjectSessions(projectId);
    return { messageKey: 'success.ok', data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle(THROTTLE_MODERATE)
  @ApiOperation({
    summary: 'Create a new chat session on a project',
    description:
      'Mode is validated against the project status (advisory rule): EXTEND is ' +
      'forbidden on `draft`, all modes are forbidden on `done`/`cancelled`. ' +
      'Otherwise mode is a hint to the FE prompt selector and is accepted.',
  })
  public async createSession(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateSessionDto,
  ): Promise<ITranslatedPayload<ChatSessionMetaResponseDto>> {
    const data = await this.service.createSession(projectId, dto);
    return { messageKey: 'success.created', data };
  }
}
