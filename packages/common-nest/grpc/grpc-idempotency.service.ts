import { Metadata } from '@grpc/grpc-js';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { GRPC_METADATA_KEYS } from '@plys/libraries/proto';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';
import { createHash } from 'crypto';

import { IHttpRequest, IHttpResponse } from './grpc-http.types';

const MAX_KEY_LENGTH = 80;
const TTL_MS = 6 * 60 * 60 * 1000;

/** gRPC operations that mirror HTTP handlers decorated with `@IdempotencyKey()`. */
export const IDEMPOTENT_GRPC_OPERATIONS = new Set([
  'aiSync.aiSyncSettings',
  'aiSync.aiSyncSkills',
  'aiSync.aiSyncTasks',
  'taskAttachments.attach',
  'taskAttachments.update',
  'settings.updateProject',
  'backlogs.createDraftTask',
  'backlogs.updateDraftTask',
  'backlogs.bulkDelete',
  'businessProjects.transitionStatus',
  'projectAiContext.logDecision',
]);

@Injectable()
export class GrpcIdempotencyService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(GrpcIdempotencyService.name, requestContext);
  }

  public async wrapDispatch(
    request: IHttpRequest,
    metadata: Metadata | undefined,
    dispatch: () => Promise<IHttpResponse>,
  ): Promise<IHttpResponse> {
    const operation = request.operation ?? '';
    if (!IDEMPOTENT_GRPC_OPERATIONS.has(operation)) {
      return dispatch();
    }

    const key = this.readIdempotencyKey(metadata);
    if (!key) {
      return dispatch();
    }

    const userId = this.requestContext.userId;
    if (!userId) {
      return dispatch();
    }

    const endpoint = `GRPC ${operation}`;
    const requestHash = this.hashBody(request.body);

    const existing = await this.uow.idempotencyKeys.findOne({
      where: { key, userId, endpoint },
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        return {
          statusCode: HttpStatus.CONFLICT,
          body: Buffer.alloc(0),
          errorCode: ERROR_CODES.IDEMPOTENCY_KEY_BODY_MISMATCH,
          messageKey: 'error.idempotency.body_mismatch',
          headers: {},
          cookies: {},
        };
      }

      this.logger.log(
        `[${this.requestContext.requestId}] idempotency — replay | key: ${key}, operation: ${operation}`,
      );

      const cachedBody =
        existing.responseBody !== null && existing.responseBody !== undefined
          ? Buffer.from(JSON.stringify(existing.responseBody))
          : Buffer.alloc(0);

      return {
        statusCode: existing.responseStatus,
        body: cachedBody,
        errorCode: '',
        messageKey: 'success.ok',
        headers: {},
        cookies: {},
      };
    }

    const response = await dispatch();

    const statusCode = response.statusCode ?? HttpStatus.OK;
    if (statusCode < HttpStatus.BAD_REQUEST) {
      let responseBody: unknown = null;
      if (response.body && response.body.length > 0) {
        try {
          responseBody = JSON.parse(response.body.toString('utf8'));
        } catch {
          responseBody = null;
        }
      }

      try {
        await this.uow.idempotencyKeys.insert({
          key,
          userId,
          endpoint,
          requestHash,
          responseStatus: statusCode,
          responseBody: responseBody as Record<string, unknown>,
          expiresAt: new Date(Date.now() + TTL_MS),
        });
      } catch (err) {
        this.logger.warn(
          `[${this.requestContext.requestId}] idempotency — store skipped | key: ${key}, error: ${(err as Error).message}`,
        );
      }
    }

    return response;
  }

  private readIdempotencyKey(metadata: Metadata | undefined): string | null {
    if (!metadata) {
      return null;
    }
    const values = metadata.get(GRPC_METADATA_KEYS.IDEMPOTENCY_KEY);
    if (!values.length) {
      return null;
    }
    const raw = typeof values[0] === 'string' ? values[0] : values[0].toString();
    const key = raw.trim();
    if (key.length === 0 || key.length > MAX_KEY_LENGTH) {
      return null;
    }
    return key;
  }

  private hashBody(body: Buffer | Uint8Array | undefined): string {
    let serialised: string;
    try {
      if (!body || body.length === 0) {
        serialised = '';
      } else {
        const text = Buffer.isBuffer(body)
          ? body.toString('utf8')
          : Buffer.from(body).toString('utf8');
        serialised = text;
      }
    } catch {
      serialised = '';
    }
    return createHash('sha256').update(serialised).digest('hex');
  }
}
