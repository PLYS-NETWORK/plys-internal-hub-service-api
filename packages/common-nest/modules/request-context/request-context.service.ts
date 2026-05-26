import { Injectable } from '@nestjs/common';
import { ActivePlatform, UserRole } from '@plys/libraries/database/enums';
import { AsyncLocalStorage } from 'async_hooks';

import {
  DEFAULT_LOCALE,
  IRequestContext,
  SupportedLocale,
} from './interfaces/request-context.interface';

@Injectable()
export class RequestContextService {
  // One AsyncLocalStorage instance shared across the NestJS DI scope.
  // Each request gets its own isolated store via run(). Static so that
  // non-DI callers (e.g. class-transformer decorators) can read the
  // current store via RequestContextService.currentTimezone() etc.
  private static readonly storage = new AsyncLocalStorage<IRequestContext>();

  public run<T>(context: IRequestContext, callback: () => T): T {
    return RequestContextService.storage.run(context, callback);
  }

  /**
   * Static accessor for the active request's timezone.
   * Used by decorators (@TimezoneDate) that run outside the DI scope.
   * Falls back to 'UTC' when no request context is active or none was supplied.
   */
  public static currentTimezone(): string {
    return RequestContextService.storage.getStore()?.timezone ?? 'UTC';
  }

  public getContext(): IRequestContext | undefined {
    return RequestContextService.storage.getStore();
  }

  public get requestId(): string {
    return RequestContextService.storage.getStore()?.requestId ?? '';
  }

  public get userId(): string | null {
    return RequestContextService.storage.getStore()?.userId ?? null;
  }

  public get email(): string | null {
    return RequestContextService.storage.getStore()?.email ?? null;
  }

  public get userRole(): UserRole | null {
    return RequestContextService.storage.getStore()?.userRole ?? null;
  }

  public get sessionId(): string | null {
    return RequestContextService.storage.getStore()?.sessionId ?? null;
  }

  public get deviceId(): string | null {
    return RequestContextService.storage.getStore()?.deviceId ?? null;
  }

  public get ipAddress(): string {
    return RequestContextService.storage.getStore()?.ipAddress ?? '';
  }

  public get userAgent(): string | null {
    return RequestContextService.storage.getStore()?.userAgent ?? null;
  }

  public get path(): string {
    return RequestContextService.storage.getStore()?.path ?? '';
  }

  public get method(): string {
    return RequestContextService.storage.getStore()?.method ?? '';
  }

  public get lang(): SupportedLocale {
    return RequestContextService.storage.getStore()?.lang ?? DEFAULT_LOCALE;
  }

  public get activePlatform(): ActivePlatform | null {
    return RequestContextService.storage.getStore()?.activePlatform ?? null;
  }

  public get businessId(): string | null {
    return RequestContextService.storage.getStore()?.businessId ?? null;
  }

  public get timezone(): string | null {
    return RequestContextService.storage.getStore()?.timezone ?? null;
  }

  public get idempotencyKey(): string | null {
    return RequestContextService.storage.getStore()?.idempotencyKey ?? null;
  }

  // Called by JwtContextMiddleware after the JWT is verified.
  public setUser(
    userId: string,
    email: string,
    userRole: UserRole,
    sessionId: string,
    deviceId: string | null,
    activePlatform: ActivePlatform,
    businessId: string | null = null,
  ): void {
    const store = RequestContextService.storage.getStore();
    if (store) {
      store.userId = userId;
      store.email = email;
      store.userRole = userRole;
      store.sessionId = sessionId;
      store.deviceId = deviceId;
      store.activePlatform = activePlatform;
      store.businessId = businessId;
    }
  }

  /**
   * Overrides the request timezone with the value stored on the active
   * `user_sessions` row, called by `JwtContextMiddleware` once the session has
   * been loaded and verified. The session timezone (captured at login time
   * from the `x-timezone` header or login DTO) is the authoritative source
   * for an authenticated request — it persists across header omissions on
   * follow-up calls. No-op when the session has no timezone stored, so the
   * header value (or `null`) survives.
   */
  public setSessionTimezone(timezone: string | null): void {
    if (!timezone) return;
    const store = RequestContextService.storage.getStore();
    if (store) {
      store.timezone = timezone;
    }
  }
}
