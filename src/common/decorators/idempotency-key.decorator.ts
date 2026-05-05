import { SetMetadata } from '@nestjs/common';

// Reflection key the IdempotencyInterceptor reads to decide whether to apply
// the cache. Endpoints opt in by adding `@IdempotencyKey()` — there is no
// global-wide application; missing the decorator means the interceptor is a
// no-op.
export const IDEMPOTENCY_KEY = 'idempotency-key';

export const IdempotencyKey = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(IDEMPOTENCY_KEY, true);
