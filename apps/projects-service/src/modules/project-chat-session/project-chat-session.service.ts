import { BusinessAccessService } from '@modules/business-projects/services/business-access.service';
import { ProjectAiContextService } from '@modules/project-ai-context/project-ai-context.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { ChatMessage, ProjectChatSession } from '@plys/libraries/database/entities';
import { ChatSessionMode, ChatSessionStatus, ProjectStatus } from '@plys/libraries/database/enums';
import { ProjectsUnitOfWorkService } from '@plys/libraries/unit-of-work/projects-unit-of-work.service';
import { plainToInstance } from 'class-transformer';
import { LessThan } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import {
  CreateSessionDto,
  ListMessagesQueryDto,
  PatchSessionDto,
  UpdateSessionStatusDto,
} from './dto/requests';
import {
  ChatMessagePageResponseDto,
  ChatMessageResponseDto,
  ChatSessionListItemResponseDto,
  ChatSessionMetaResponseDto,
  PatchSessionResponseDto,
} from './dto/responses';
import { IProjectChatSessionService } from './interfaces/project-chat-session.service.interface';

// Hard cap on messages per session. The FE summarises well before this; the
// cap is a defense-in-depth guard against an in-tab loop or abuse. When hit,
// the user starts a new session — old transcripts stay readable.
const MAX_MESSAGES_PER_SESSION = 200;

// Mode↔status compatibility (advisory). Any non-terminal status accepts every
// mode except `EXTEND` on `draft` (nothing exists yet to extend). Terminal
// statuses (`done`, `cancelled`) reject all modes — completed projects are
// read-only.
const MODE_BY_STATUS: Record<ProjectStatus, ReadonlySet<ChatSessionMode>> = {
  [ProjectStatus.DRAFT]: new Set([ChatSessionMode.PLANNING, ChatSessionMode.REFINE]),
  [ProjectStatus.CONFIGURED]: new Set([
    ChatSessionMode.PLANNING,
    ChatSessionMode.REFINE,
    ChatSessionMode.EXTEND,
  ]),
  [ProjectStatus.PUBLISHED]: new Set([
    ChatSessionMode.PLANNING,
    ChatSessionMode.REFINE,
    ChatSessionMode.EXTEND,
  ]),
  [ProjectStatus.IN_PROGRESS]: new Set([
    ChatSessionMode.PLANNING,
    ChatSessionMode.REFINE,
    ChatSessionMode.EXTEND,
  ]),
  [ProjectStatus.DONE]: new Set(),
  [ProjectStatus.CANCELLED]: new Set(),
};

@Injectable()
export class ProjectChatSessionService implements IProjectChatSessionService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: ProjectsUnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
    private readonly aiContext: ProjectAiContextService,
  ) {
    this.logger = new AppLogger(ProjectChatSessionService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async listProjectSessions(projectId: string): Promise<ChatSessionListItemResponseDto[]> {
    this.logger.log(`[${this.rid}] listProjectSessions — start | projectId: ${projectId}`);
    await this.access.resolveOwnedProject(projectId);
    const userId = this.requireUserId();

    const rows = await this.uow.projectChatSessions.find({
      where: { projectId, userId },
      order: { updatedAt: 'DESC' },
    });

    this.logger.log(
      `[${this.rid}] listProjectSessions — complete | projectId: ${projectId}, count: ${rows.length}`,
    );
    return rows.map((row) => this.toListItemDto(row));
  }

  /** @inheritdoc */
  public async createSession(
    projectId: string,
    dto: CreateSessionDto,
  ): Promise<ChatSessionMetaResponseDto> {
    this.logger.log(
      `[${this.rid}] createSession — start | projectId: ${projectId}, mode: ${dto.mode}`,
    );
    const { project } = await this.access.resolveOwnedProject(projectId);
    const userId = this.requireUserId();

    this.assertModeAllowed(project.status, dto.mode);

    // Lazy-create the project_ai_context row so the next bootstrap returns
    // a populated `context` block instead of `null`. Done in the same tx as
    // the session insert so a session never exists without its context.
    const saved = await this.uow.withTransaction(async (tx) => {
      await this.aiContext.ensureExists(tx, projectId);
      return tx.projectChatSessions.save(
        tx.projectChatSessions.create({
          projectId,
          userId,
          mode: dto.mode,
          title: dto.title,
          status: ChatSessionStatus.ACTIVE,
          draft: {},
          messageCount: 0,
        }),
      );
    });

    this.logger.log(
      `[${this.rid}] createSession — complete | sessionId: ${saved.id}, mode: ${saved.mode}`,
    );
    return this.toMetaDto(saved);
  }

  /** @inheritdoc */
  public async getSessionMeta(sessionId: string): Promise<ChatSessionMetaResponseDto> {
    this.logger.log(`[${this.rid}] getSessionMeta — start | sessionId: ${sessionId}`);
    const session = await this.findOwnedSessionOrThrow(sessionId);
    this.logger.log(`[${this.rid}] getSessionMeta — complete | sessionId: ${session.id}`);
    return this.toMetaDto(session);
  }

  /** @inheritdoc */
  public async patchSession(
    sessionId: string,
    dto: PatchSessionDto,
  ): Promise<PatchSessionResponseDto> {
    const userId = this.requireUserId();
    const appendCount = dto.appendMessages?.length ?? 0;
    this.logger.log(
      `[${this.rid}] patchSession — start | sessionId: ${sessionId}, appends: ${appendCount}, ` +
        `draft: ${dto.draft !== undefined ? 'set' : 'unchanged'}, stage: ${dto.stage !== undefined ? `'${dto.stage ?? 'null'}'` : 'unchanged'}`,
    );

    const result = await this.uow.withTransaction(async (tx) => {
      // Lock the session row up front — concurrent appends from two devices
      // serialise here so `seq` allocation can't collide.
      const session = await tx.projectChatSessions
        .createQueryBuilder('s')
        .where('s.id = :id AND s.user_id = :userId', { id: sessionId, userId })
        .setLock('pessimistic_write')
        .getOne();
      if (!session) {
        throw this.notFound('patchSession', sessionId);
      }
      if (session.status !== ChatSessionStatus.ACTIVE) {
        this.logger.warn(
          `[${this.rid}] patchSession — not active | sessionId: ${session.id}, status: ${session.status}`,
        );
        throw new TranslatableException({
          messageKey: 'error.chat_session.not_active',
          errorCode: ERROR_CODES.CHAT_SESSION_NOT_ACTIVE,
          status: HttpStatus.CONFLICT,
        });
      }

      const newCount = session.messageCount + appendCount;
      if (newCount > MAX_MESSAGES_PER_SESSION) {
        this.logger.warn(
          `[${this.rid}] patchSession — limit exceeded | sessionId: ${session.id}, ` +
            `current: ${session.messageCount}, append: ${appendCount}, max: ${MAX_MESSAGES_PER_SESSION}`,
        );
        throw new TranslatableException({
          messageKey: 'error.chat_session.message_limit_exceeded',
          errorCode: ERROR_CODES.CHAT_SESSION_MESSAGE_LIMIT_EXCEEDED,
          status: HttpStatus.PAYLOAD_TOO_LARGE,
        });
      }

      if (dto.appendMessages && dto.appendMessages.length > 0) {
        // `parts` and `metadata` are JSONB blobs the BE never introspects —
        // the AI SDK's UIMessage shape is a discriminated union we intentionally
        // store opaquely. TypeORM's `QueryDeepPartialEntity` doesn't model
        // arbitrary nested JSON cleanly, so we cast at the persistence boundary
        // rather than over-type the entity columns.
        const rows = dto.appendMessages.map((m, i) => ({
          sessionId: session.id,
          seq: session.messageCount + i + 1,
          role: m.role,
          parts: m.parts,
          metadata: m.metadata ?? null,
        })) as unknown as QueryDeepPartialEntity<ChatMessage>[];
        await tx.chatMessages.insert(rows);
        session.messageCount = newCount;
      }

      if (dto.draft !== undefined) session.draft = dto.draft;
      if (dto.stage !== undefined) session.stage = dto.stage;

      return tx.projectChatSessions.save(session);
    });

    this.logger.log(
      `[${this.rid}] patchSession — complete | sessionId: ${result.id}, message_count: ${result.messageCount}`,
    );
    return plainToInstance(
      PatchSessionResponseDto,
      {
        id: result.id,
        message_count: result.messageCount,
        updated_at: result.updatedAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async listMessages(
    sessionId: string,
    query: ListMessagesQueryDto,
  ): Promise<ChatMessagePageResponseDto> {
    const limit = query.limit ?? 30;
    this.logger.log(
      `[${this.rid}] listMessages — start | sessionId: ${sessionId}, before: ${query.before ?? '<head>'}, limit: ${limit}`,
    );
    const session = await this.findOwnedSessionOrThrow(sessionId);

    const rows = await this.uow.chatMessages.find({
      where: {
        sessionId: session.id,
        ...(query.before !== undefined ? { seq: LessThan(query.before) } : {}),
      },
      order: { seq: 'DESC' },
      take: limit,
    });

    const next_cursor = rows.length === limit ? rows[rows.length - 1].seq : null;

    this.logger.log(
      `[${this.rid}] listMessages — complete | sessionId: ${session.id}, returned: ${rows.length}, next: ${next_cursor ?? 'none'}`,
    );

    return plainToInstance(
      ChatMessagePageResponseDto,
      {
        messages: rows.map((row) => this.toMessageDto(row)),
        next_cursor,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async updateStatus(
    sessionId: string,
    dto: UpdateSessionStatusDto,
  ): Promise<ChatSessionMetaResponseDto> {
    this.logger.log(
      `[${this.rid}] updateStatus — start | sessionId: ${sessionId}, status: ${dto.status}`,
    );

    const updated = await this.uow.withTransaction(async (tx) => {
      const userId = this.requireUserId();
      const session = await tx.projectChatSessions
        .createQueryBuilder('s')
        .where('s.id = :id AND s.user_id = :userId', { id: sessionId, userId })
        .setLock('pessimistic_write')
        .getOne();
      if (!session) {
        throw this.notFound('updateStatus', sessionId);
      }
      if (session.status !== ChatSessionStatus.ACTIVE) {
        // The DTO already restricts target status to completed/abandoned; we
        // additionally refuse to mutate already-closed sessions so the audit
        // fields (`implemented_at`, `created_task_ids`) aren't overwritten.
        throw new TranslatableException({
          messageKey: 'error.chat_session.not_active',
          errorCode: ERROR_CODES.CHAT_SESSION_NOT_ACTIVE,
          status: HttpStatus.CONFLICT,
        });
      }
      session.status = dto.status;
      if (dto.status === ChatSessionStatus.COMPLETED) {
        session.implementedAt = new Date();
        if (dto.createdTaskIds && dto.createdTaskIds.length > 0) {
          session.createdTaskIds = dto.createdTaskIds;
        }
      }
      return tx.projectChatSessions.save(session);
    });

    this.logger.log(
      `[${this.rid}] updateStatus — complete | sessionId: ${updated.id}, status: ${updated.status}`,
    );
    return this.toMetaDto(updated);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async findOwnedSessionOrThrow(sessionId: string): Promise<ProjectChatSession> {
    const userId = this.requireUserId();
    const session = await this.uow.projectChatSessions.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw this.notFound('findOwnedSessionOrThrow', sessionId);
    }
    return session;
  }

  private notFound(method: string, sessionId: string): TranslatableException {
    this.logger.warn(`[${this.rid}] ${method} — not found | sessionId: ${sessionId}`);
    return new TranslatableException({
      messageKey: 'error.chat_session.not_found',
      errorCode: ERROR_CODES.CHAT_SESSION_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    });
  }

  private assertModeAllowed(status: ProjectStatus, mode: ChatSessionMode): void {
    const allowed = MODE_BY_STATUS[status];
    if (!allowed.has(mode)) {
      this.logger.warn(
        `[${this.rid}] assertModeAllowed — refused | status: ${status}, mode: ${mode}`,
      );
      throw new TranslatableException({
        messageKey: 'error.chat_session.mode_not_allowed',
        errorCode: ERROR_CODES.CHAT_SESSION_MODE_NOT_ALLOWED,
        status: HttpStatus.CONFLICT,
        args: { status, mode },
      });
    }
  }

  private requireUserId(): string {
    const userId = this.requestContext.userId;
    if (!userId) {
      // Should be unreachable: BusinessAccessService rejects missing context
      // first. Keep the guard for defence in depth + a clear error code.
      throw new TranslatableException({
        messageKey: 'error.generic.unauthorized',
        errorCode: ERROR_CODES.GENERIC_UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      });
    }
    return userId;
  }

  private toListItemDto(row: ProjectChatSession): ChatSessionListItemResponseDto {
    return plainToInstance(
      ChatSessionListItemResponseDto,
      {
        id: row.id,
        mode: row.mode,
        stage: row.stage,
        title: row.title,
        status: row.status,
        message_count: row.messageCount,
        implemented_at: row.implementedAt,
        created_task_ids: row.createdTaskIds,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  private toMetaDto(row: ProjectChatSession): ChatSessionMetaResponseDto {
    return plainToInstance(
      ChatSessionMetaResponseDto,
      {
        id: row.id,
        project_id: row.projectId,
        user_id: row.userId,
        mode: row.mode,
        stage: row.stage,
        title: row.title,
        status: row.status,
        draft: row.draft,
        message_count: row.messageCount,
        implemented_at: row.implementedAt,
        created_task_ids: row.createdTaskIds,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  private toMessageDto(row: ChatMessage): ChatMessageResponseDto {
    return plainToInstance(
      ChatMessageResponseDto,
      {
        id: row.id,
        seq: row.seq,
        role: row.role,
        parts: row.parts,
        metadata: row.metadata,
        created_at: row.createdAt,
      },
      { excludeExtraneousValues: true },
    );
  }
}
