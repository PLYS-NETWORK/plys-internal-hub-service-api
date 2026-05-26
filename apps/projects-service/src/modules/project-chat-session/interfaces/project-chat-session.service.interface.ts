import {
  CreateSessionDto,
  ListMessagesQueryDto,
  PatchSessionDto,
  UpdateSessionStatusDto,
} from '../dto/requests';
import {
  ChatMessagePageResponseDto,
  ChatSessionListItemResponseDto,
  ChatSessionMetaResponseDto,
  PatchSessionResponseDto,
} from '../dto/responses';

export interface IProjectChatSessionService {
  /**
   * Lists every session a business user has on a project, newest-first.
   * Excludes message bodies and draft state — purely picker metadata.
   *
   * @param projectId Project to list sessions for.
   * @returns Sessions ordered by `updated_at` DESC.
   * @throws TranslatableException 403 BUSINESS_PROFILE_NOT_FOUND.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   */
  listProjectSessions(projectId: string): Promise<ChatSessionListItemResponseDto[]>;

  /**
   * Creates a new chat session on a project. Mode is validated against the
   * project's current status (advisory rule): all modes are allowed in non-
   * terminal statuses; `EXTEND` is rejected on `draft`; any session creation
   * is rejected on terminal statuses (`done`, `cancelled`).
   *
   * @param projectId Owning project.
   * @param dto Mode + title.
   * @returns Newly-created session metadata (with empty `draft`).
   * @throws TranslatableException 403 BUSINESS_PROFILE_NOT_FOUND.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   * @throws TranslatableException 409 CHAT_SESSION_MODE_NOT_ALLOWED.
   */
  createSession(projectId: string, dto: CreateSessionDto): Promise<ChatSessionMetaResponseDto>;

  /**
   * Returns a session's metadata + draft for the calling user. Excludes
   * messages — fetch those via `listMessages` to keep the row read cheap.
   *
   * @param sessionId Session to read.
   * @returns Full meta payload with `draft` populated.
   * @throws TranslatableException 404 CHAT_SESSION_NOT_FOUND if missing or
   *   not owned by the calling user.
   */
  getSessionMeta(sessionId: string): Promise<ChatSessionMetaResponseDto>;

  /**
   * Atomic write: appends N messages, optionally replaces `draft`, optionally
   * updates `stage`. The session row is locked (`pessimistic_write`) so
   * concurrent appends from two devices serialise. Rejects when the session
   * is not active or when the post-insert message count would exceed 200.
   *
   * @param sessionId Session to mutate.
   * @param dto Append payload + draft / stage updates.
   * @returns Echo of the new message count + updated_at for optimistic UI.
   * @throws TranslatableException 404 CHAT_SESSION_NOT_FOUND.
   * @throws TranslatableException 409 CHAT_SESSION_NOT_ACTIVE.
   * @throws TranslatableException 413 CHAT_SESSION_MESSAGE_LIMIT_EXCEEDED.
   */
  patchSession(sessionId: string, dto: PatchSessionDto): Promise<PatchSessionResponseDto>;

  /**
   * Cursor-paginated, newest-first message list for a session. Cursor is the
   * monotonic per-session `seq`; pass `before` to advance.
   *
   * @param sessionId Session to read.
   * @param query Pagination params.
   * @returns Messages + next cursor (null when exhausted).
   * @throws TranslatableException 404 CHAT_SESSION_NOT_FOUND.
   */
  listMessages(sessionId: string, query: ListMessagesQueryDto): Promise<ChatMessagePageResponseDto>;

  /**
   * Marks an active session as `completed` or `abandoned`. `completed` is
   * the FE's signal after a successful AI-sync apply; `abandoned` is set by
   * the housekeeping cron (later step).
   *
   * @param sessionId Session to mark.
   * @param dto New status + optional `created_task_ids` audit.
   * @returns Updated session metadata.
   * @throws TranslatableException 404 CHAT_SESSION_NOT_FOUND.
   * @throws TranslatableException 409 CHAT_SESSION_NOT_ACTIVE.
   */
  updateStatus(sessionId: string, dto: UpdateSessionStatusDto): Promise<ChatSessionMetaResponseDto>;
}
