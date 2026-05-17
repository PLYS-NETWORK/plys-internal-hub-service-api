// Named throttle tiers shared across modules. Each tier is a ready-to-use
// argument for `@Throttle(...)` from `@nestjs/throttler`. The `default` key
// matches the throttler name registered in AuthModule (`name: 'default'`),
// so tiers transparently override the global 60/min limit on a per-route basis.
// TTL is in milliseconds (NestJS throttler v5+).
export const THROTTLE_DISCOVERY = {
  default: { limit: 60, ttl: 60_000 },
} as const;

export const THROTTLE_STRICT = {
  default: { limit: 5, ttl: 60_000 },
} as const;
