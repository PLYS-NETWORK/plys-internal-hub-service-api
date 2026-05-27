import { timingSafeEqual } from 'node:crypto';

import { Metadata } from '@grpc/grpc-js';
import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { GRPC_METADATA_KEYS } from '@plys/libraries/proto';

function readMetadataValue(metadata: Metadata, key: string): string | undefined {
  const values = metadata.get(key);
  if (!values.length) {
    return undefined;
  }
  const first = values[0];
  return typeof first === 'string' ? first : first.toString();
}

export function resolveGrpcServiceSecret(): string {
  return process.env.GRPC_SERVICE_SECRET ?? '';
}

export function isGrpcServiceAuthRequired(): boolean {
  const deployEnv = process.env.DEPLOY_ENV ?? 'local';
  return deployEnv === 'dev' || deployEnv === 'prod';
}

/**
 * Validates the shared service secret on inbound gRPC calls.
 * Skipped in local when GRPC_SERVICE_SECRET is unset (dev ergonomics).
 */
export function assertGrpcServiceAuthorized(metadata: Metadata | undefined): void {
  const expected = resolveGrpcServiceSecret();
  if (!isGrpcServiceAuthRequired() && expected.length === 0) {
    return;
  }

  if (expected.length === 0) {
    throw new TranslatableException({
      messageKey: 'error.auth.api_key_invalid',
      errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
      status: HttpStatus.UNAUTHORIZED,
    });
  }

  const provided = metadata
    ? readMetadataValue(metadata, GRPC_METADATA_KEYS.SERVICE_AUTH)
    : undefined;
  if (
    typeof provided !== 'string' ||
    provided.length !== expected.length ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  ) {
    throw new TranslatableException({
      messageKey: 'error.auth.api_key_invalid',
      errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
      status: HttpStatus.UNAUTHORIZED,
    });
  }
}
