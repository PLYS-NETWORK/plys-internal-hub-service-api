// Named throttle tiers shared across modules. Each tier is a ready-to-use
// argument for `@Throttle(...)` from `@nestjs/throttler`. The `default` key
// matches the throttler name registered in AuthModule (`name: 'default'`),
// so tiers transparently override the global 60/min limit on a per-route basis.
// TTL is in milliseconds (NestJS throttler v5+).
//
// Apply at the controller class level by default; override at the method level
// only when a single route needs a tier that diverges from the controller's
// spine. NestJS resolves @Throttle method-over-class, so the override pattern
// is safe with no manual stacking.

/** Cached public reference data — 120 req / 60 s (e.g. skills list, health). */
export const THROTTLE_PUBLIC_READ = {
  default: { limit: 120, ttl: 60_000 },
} as const;

/** Standard authenticated reads — 60 req / 60 s. Matches the global default. */
export const THROTTLE_DEFAULT = {
  default: { limit: 60, ttl: 60_000 },
} as const;

/** Polled/refreshed surfaces — 30 req / 60 s (refresh token, chat sessions, dashboards). */
export const THROTTLE_INTERACTIVE = {
  default: { limit: 30, ttl: 60_000 },
} as const;

/** Moderate writes — 10 req / 60 s (verify-email, reset-password, SSO exchange, uploads). */
export const THROTTLE_MODERATE = {
  default: { limit: 10, ttl: 60_000 },
} as const;

/** Sensitive writes — 5 req / 60 s (login, register, task transitions, money operations). */
export const THROTTLE_STRICT = {
  default: { limit: 5, ttl: 60_000 },
} as const;

/** OTP-issuing endpoints — 5 req / 15 min (forgot-password, resend-verification, admin OTP). */
export const THROTTLE_OTP = {
  default: { limit: 5, ttl: 900_000 },
} as const;

/** Inbound webhooks from trusted external services — 600 req / 60 s (Polar, Stripe). */
export const THROTTLE_WEBHOOK = {
  default: { limit: 600, ttl: 60_000 },
} as const;
