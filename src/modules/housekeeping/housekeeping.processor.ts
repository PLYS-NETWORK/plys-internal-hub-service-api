import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ChatSessionStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';

import {
  ABANDON_STALE_SESSION_DAYS,
  ABANDON_STALE_SESSION_MIN_MESSAGES,
  HOUSEKEEPING_JOBS,
  HOUSEKEEPING_QUEUE,
  REINDEX_STALENESS_DAYS,
} from './housekeeping.constants';

// Bull worker for the three repeating housekeeping jobs. No AI calls here —
// every job is a single SQL DELETE/UPDATE wrapped in structured logging so
// ops can grep `housekeeping —` for cadence + row counts. Failures bubble up
// to Bull, which retries with exponential backoff (configured at enqueue
// time in the scheduler).
//
// The Bull `Job` payload is empty — these are scheduled tasks, not data
// pipelines. Job IDs come from Bull's repeatable-job machinery.
@Processor(HOUSEKEEPING_QUEUE)
export class HousekeepingProcessor {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(HousekeepingProcessor.name, requestContext);
  }

  // Background jobs run outside any request context, so `this.rid` is
  // always empty. Tag the log line with the Bull job id instead so retries
  // and the failed-queue inspection have a stable correlation handle.
  private prefix(job: Job): string {
    return `[bull:${job.id}]`;
  }

  /**
   * Idempotency cache cleanup. Cap is 6h per row (set by IdempotencyInterceptor
   * in C-6); a 15-minute sweep keeps the table small.
   */
  @Process(HOUSEKEEPING_JOBS.EXPIRE_IDEMPOTENCY_KEYS)
  public async expireIdempotencyKeys(job: Job): Promise<{ deleted: number }> {
    this.logger.log(`${this.prefix(job)} expireIdempotencyKeys — start`);
    try {
      const result = await this.uow.idempotencyKeys.query<[unknown[], number]>(
        `DELETE FROM "idempotency_key" WHERE "expires_at" < NOW()`,
      );
      // Postgres' DELETE returns `[rows, affected]` via TypeORM's manager.query.
      const deleted = Array.isArray(result) ? Number(result[1] ?? 0) : 0;
      this.logger.log(`${this.prefix(job)} expireIdempotencyKeys — complete | deleted: ${deleted}`);
      return { deleted };
    } catch (err) {
      this.logger.error(
        `${this.prefix(job)} expireIdempotencyKeys — failed | error: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  /**
   * Marks long-idle, low-traffic chat sessions as `abandoned` so the FE
   * picker stops surfacing them. Both thresholds (90 days idle + < 5
   * messages) are deliberate — long-running planning chats with real
   * history stay active.
   */
  @Process(HOUSEKEEPING_JOBS.ABANDON_STALE_SESSIONS)
  public async abandonStaleSessions(job: Job): Promise<{ updated: number }> {
    this.logger.log(`${this.prefix(job)} abandonStaleSessions — start`);
    try {
      const result = await this.uow.projectChatSessions.query<[unknown[], number]>(
        `UPDATE "project_chat_session"
            SET "status" = $1, "updated_at" = NOW()
          WHERE "status" = $2
            AND "updated_at" < NOW() - ($3::int || ' days')::interval
            AND "message_count" < $4`,
        [
          ChatSessionStatus.ABANDONED,
          ChatSessionStatus.ACTIVE,
          ABANDON_STALE_SESSION_DAYS,
          ABANDON_STALE_SESSION_MIN_MESSAGES,
        ],
      );
      const updated = Array.isArray(result) ? Number(result[1] ?? 0) : 0;
      this.logger.log(
        `${this.prefix(job)} abandonStaleSessions — complete | updated: ${updated}, ` +
          `idle_days: ${ABANDON_STALE_SESSION_DAYS}, msg_threshold: ${ABANDON_STALE_SESSION_MIN_MESSAGES}`,
      );
      return { updated };
    } catch (err) {
      this.logger.error(
        `${this.prefix(job)} abandonStaleSessions — failed | error: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  /**
   * Stale-context fallback. The BE-maintained `task_index` updates in real
   * time, but the FE-derived fields (`domain`, `*_summary`, …) only refresh
   * when the FE writes them back. After 7 days without a derived-write,
   * flip `needs_reindex=true` so the next bootstrap nudges the FE.
   */
  @Process(HOUSEKEEPING_JOBS.FLAG_PROJECTS_FOR_REINDEX)
  public async flagProjectsForReindex(job: Job): Promise<{ flagged: number }> {
    this.logger.log(`${this.prefix(job)} flagProjectsForReindex — start`);
    try {
      const result = await this.uow.projectAiContexts.query<[unknown[], number]>(
        `UPDATE "project_ai_context"
            SET "needs_reindex" = TRUE, "updated_at" = NOW()
          WHERE "needs_reindex" = FALSE
            AND "last_indexed_at" < NOW() - ($1::int || ' days')::interval`,
        [REINDEX_STALENESS_DAYS],
      );
      const flagged = Array.isArray(result) ? Number(result[1] ?? 0) : 0;
      this.logger.log(
        `${this.prefix(job)} flagProjectsForReindex — complete | flagged: ${flagged}, ` +
          `staleness_days: ${REINDEX_STALENESS_DAYS}`,
      );
      return { flagged };
    } catch (err) {
      this.logger.error(
        `${this.prefix(job)} flagProjectsForReindex — failed | error: ${(err as Error).message}`,
      );
      throw err;
    }
  }
}
