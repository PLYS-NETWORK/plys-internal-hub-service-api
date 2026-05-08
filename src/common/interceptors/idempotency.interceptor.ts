import { ERROR_CODES } from '@common/constants/error-codes';
import { IDEMPOTENCY_KEY } from '@common/decorators/idempotency-key.decorator';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import { FastifyReply, FastifyRequest } from 'fastify';
import { from, Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

// Header the client must send to opt into the cache. Standard naming, lower-
// case (Fastify normalises). Endpoints that don't see a header pass through
// unchanged — the cache is opt-in by the caller, not enforced by the BE.
const HEADER = 'idempotency-key';

// 6h matches the plan's §C.7.1 sizing — covers normal client retry windows
// without keeping rows around for days.
const TTL_MS = 6 * 60 * 60 * 1000;

// Keys longer than this are user-supplied junk; reject early so the PK column
// (VARCHAR(80)) doesn't have to.
const MAX_KEY_LENGTH = 80;

interface IIdempotencyHit {
  responseStatus: number;
  responseBody: unknown;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger: AppLogger;

  constructor(
    private readonly reflector: Reflector,
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(IdempotencyInterceptor.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const optedIn = this.reflector.getAllAndOverride<boolean>(IDEMPOTENCY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!optedIn) return next.handle();

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const response = context.switchToHttp().getResponse<FastifyReply>();
    const headerValue = (request.headers as Record<string, string | undefined>)[HEADER];

    // No header = pass-through. The endpoint stays usable for clients that
    // don't care about replay safety.
    if (!headerValue) return next.handle();

    const key = headerValue.trim();
    if (key.length === 0 || key.length > MAX_KEY_LENGTH) {
      this.logger.warn(
        `[${this.rid}] idempotency — invalid header | length: ${headerValue.length}, endpoint: ${request.url}`,
      );
      return next.handle();
    }

    const userId = this.requestContext.userId;
    if (!userId) {
      // Idempotency rows are user-scoped; without a user we have no way to
      // namespace cache hits safely. Skip rather than fail the request — the
      // caller will hit auth-related errors first anyway.
      return next.handle();
    }

    const endpoint = `${request.method} ${this.routePath(context, request)}`;
    const requestHash = this.hashBody(request.body);

    return from(this.runWithCache(key, userId, endpoint, requestHash, response, next));
  }

  private async runWithCache(
    key: string,
    userId: string,
    endpoint: string,
    requestHash: string,
    response: FastifyReply,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const existing = await this.uow.idempotencyKeys.findOne({
      where: { key, userId, endpoint },
    });

    if (existing) {
      // Hit — replay the cached response only if the body matches.
      // A different body under the same key is the classic "client retried
      // but with new data" bug; surface 409 so the bug is loud.
      if (existing.requestHash !== requestHash) {
        this.logger.warn(
          `[${this.rid}] idempotency — body mismatch | key: ${key}, endpoint: ${endpoint}`,
        );
        throw new ConflictException(
          new TranslatableException({
            messageKey: 'error.idempotency.body_mismatch',
            errorCode: ERROR_CODES.IDEMPOTENCY_KEY_BODY_MISMATCH,
            status: HttpStatus.CONFLICT,
          }).getResponse(),
        );
      }
      this.logger.log(
        `[${this.rid}] idempotency — replay | key: ${key}, endpoint: ${endpoint}, status: ${existing.responseStatus}`,
      );
      response.status(existing.responseStatus);
      return of(existing.responseBody as IIdempotencyHit['responseBody']);
    }

    // Miss — run the handler, capture the response payload, persist for next
    // time. The store is best-effort: a parallel race that lands two writes
    // for the same key collapses on the (key, user, endpoint) PK with one
    // surviving — the loser's INSERT throws and we swallow it because the
    // handler already produced the canonical response.
    return next.handle().pipe(
      tap((body) => {
        void this.persist({
          key,
          userId,
          endpoint,
          requestHash,
          responseStatus: response.statusCode,
          responseBody: body,
        });
      }),
    );
  }

  private async persist(row: {
    key: string;
    userId: string;
    endpoint: string;
    requestHash: string;
    responseStatus: number;
    responseBody: unknown;
  }): Promise<void> {
    try {
      // `responseBody` is JSONB-typed `unknown` on the entity (any controller
      // payload shape). TypeORM's deep-partial can't model that, so we cast
      // at the persistence boundary rather than over-typing the column.
      await this.uow.idempotencyKeys.insert({
        key: row.key,
        userId: row.userId,
        endpoint: row.endpoint,
        requestHash: row.requestHash,
        responseStatus: row.responseStatus,
        responseBody: row.responseBody as Record<string, unknown>,
        expiresAt: new Date(Date.now() + TTL_MS),
      });
    } catch (err) {
      // PK collision (race) is a no-op — another concurrent request already
      // cached. Anything else is logged but doesn't fail the user's call.
      this.logger.warn(
        `[${this.rid}] idempotency — store skipped | key: ${row.key}, error: ${(err as Error).message}`,
      );
    }
  }

  private hashBody(body: unknown): string {
    // Stable stringification: JSON.stringify uses insertion order. For our
    // payloads (controlled by the client) that's good enough — clients that
    // produce key-shuffled retries get a body-mismatch 409, which is the
    // correct signal that something changed.
    let serialised: string;
    try {
      serialised = body === undefined ? '' : JSON.stringify(body);
    } catch {
      serialised = '';
    }
    return createHash('sha256').update(serialised).digest('hex');
  }

  private routePath(context: ExecutionContext, request: FastifyRequest): string {
    // Prefer the controller-class path + handler-method path metadata so two
    // distinct endpoints sharing a final URL component (with different params)
    // don't share a cache row. Fall back to `request.routeOptions?.url` then
    // the raw URL.
    const routeUrl =
      (request as unknown as { routeOptions?: { url?: string } }).routeOptions?.url ??
      (request as unknown as { routerPath?: string }).routerPath ??
      request.url;
    return routeUrl ?? '';
  }
}
