import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE_INTERACTIVE } from '@plys/libraries/common-nest/constants';
import { Platform } from '@plys/libraries/common-nest/decorators/platform.decorator';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { PlatformGuard } from '@plys/libraries/common-nest/guards/platform.guard';
import { RolesGuard } from '@plys/libraries/common-nest/guards/roles.guard';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@plys/libraries/database/enums';

import { ListMessagesQueryDto, PatchSessionDto, UpdateSessionStatusDto } from '../dto/requests';
import {
  ChatMessagePageResponseDto,
  ChatSessionMetaResponseDto,
  PatchSessionResponseDto,
} from '../dto/responses';
import { ProjectChatSessionService } from '../project-chat-session.service';

// Session-scoped routes. Ownership is checked inside the service: rows must
// match `(id, user_id)` from RequestContext, otherwise 404
// (CHAT_SESSION_NOT_FOUND). Routes here therefore don't need a per-project
// path segment — the session id alone is enough.
@ApiTags('Project Chat Sessions')
@ApiBearerAuth()
@Controller('chat-sessions/:sessionId')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.BUSINESS)
@Throttle(THROTTLE_INTERACTIVE)
export class ChatSessionsController {
  constructor(private readonly service: ProjectChatSessionService) {}

  @Get('meta')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Get a session's metadata + draft (no messages)",
  })
  public async getMeta(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<ITranslatedPayload<ChatSessionMetaResponseDto>> {
    const data = await this.service.getSessionMeta(sessionId);
    return { messageKey: 'success.ok', data };
  }

  @Patch()
  // FE patches once per chat turn — typical AI exchange produces 1–3 messages,
  // so 30 patches/min per (user, IP) is generous for normal use and shuts
  // down a runaway in-tab loop or scripted abuse. Inherits the class-level
  // THROTTLE_INTERACTIVE tier.
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Append messages and/or update the session draft / stage',
    description:
      'Single transaction: locks the session row, allocates `seq` ordinals for ' +
      'every appended message, inserts them, and replaces draft/stage as ' +
      'provided. Refuses with 413 once `message_count` would exceed 200. ' +
      'Rate limited at 30 req/min per caller.',
  })
  public async patch(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: PatchSessionDto,
  ): Promise<ITranslatedPayload<PatchSessionResponseDto>> {
    const data = await this.service.patchSession(sessionId, dto);
    return { messageKey: 'success.ok', data };
  }

  @Get('messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Paginated message list, newest-first by `seq`',
    description:
      'Pass `before=<seq>` to advance the cursor; omit on the first page. The ' +
      'index `idx_chat_message_session_seq_desc` makes this an index-only scan ' +
      'regardless of how long the conversation gets.',
  })
  public async listMessages(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Query() query: ListMessagesQueryDto,
  ): Promise<ITranslatedPayload<ChatMessagePageResponseDto>> {
    const data = await this.service.listMessages(sessionId, query);
    return { messageKey: 'success.ok', data };
  }

  @Patch('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark a session `completed` or `abandoned`',
    description:
      "`completed` is the FE's signal after a successful AI-sync apply — the " +
      'BE stamps `implemented_at` and persists `created_task_ids` for audit. ' +
      '`abandoned` is also accepted for manual cleanup.',
  })
  public async updateStatus(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: UpdateSessionStatusDto,
  ): Promise<ITranslatedPayload<ChatSessionMetaResponseDto>> {
    const data = await this.service.updateStatus(sessionId, dto);
    return { messageKey: 'success.ok', data };
  }
}
