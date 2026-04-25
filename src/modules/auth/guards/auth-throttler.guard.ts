import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Throttler guard that keys on `<route>:<email|code>:<ip>` for credential-
 * bearing endpoints (login, forgot-password, reset-password, sso-exchange)
 * and falls back to the default IP-only tracker everywhere else.
 *
 * Why: a default IP-only key lets a single attacker burn another user's
 * quota by hammering /login with the victim's email — locking the legitimate
 * user out via the throttler. Composing email + ip avoids that DoS.
 */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  private static readonly EMAIL_KEYED_ROUTES = new Set<string>([
    '/api/v1/auth/login',
    '/api/v1/auth/forgot-password',
    '/api/v1/auth/reset-password',
    '/api/v1/auth/sso/exchange',
  ]);

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    // Default — IP from req.ip (Fastify populates from trustProxy or socket).
    const ip = typeof req.ip === 'string' ? req.ip : '0.0.0.0';
    const url = typeof req.url === 'string' ? req.url : '';
    const path = url.split('?')[0];

    if (AuthThrottlerGuard.EMAIL_KEYED_ROUTES.has(path)) {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const email = typeof body.email === 'string' ? body.email.toLowerCase() : '';
      // /sso/exchange has no email field — compose with the code prefix so
      // per-IP exhaustion cannot be bypassed by rotating proxies.
      const code = typeof body.code === 'string' ? body.code.slice(0, 8) : '';
      return `${path}:${email || code || 'anon'}:${ip}`;
    }
    return ip;
  }
}
