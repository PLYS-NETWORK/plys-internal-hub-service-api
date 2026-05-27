const LOCALHOST_ORIGIN_PATTERN = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;

/** Returns true when the origin is a local development host (any port). */
export function isLocalhostOrigin(origin: string): boolean {
  return LOCALHOST_ORIGIN_PATTERN.test(origin);
}

export type CorsOriginCallback = (err: Error | null, allow: boolean) => void;

/**
 * Fastify / Socket.IO compatible CORS origin delegate. When `corsAllowLocalhost`
 * is enabled (dev deploy only), any localhost origin is accepted without being
 * listed in `allowedOrigins`.
 */
export function createCorsOriginDelegate(
  allowedOrigins: readonly string[],
  corsAllowLocalhost: boolean,
): (origin: string | undefined, callback: CorsOriginCallback) => void {
  return (origin: string | undefined, callback: CorsOriginCallback): void => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (corsAllowLocalhost && isLocalhostOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(null, allowedOrigins.includes(origin));
  };
}
