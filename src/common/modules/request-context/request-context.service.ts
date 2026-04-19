import { ActivePlatform } from '@database/enums/active-platform.enum';
import { UserRole } from '@database/enums/user-role.enum';
import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

import {
  DEFAULT_LOCALE,
  IRequestContext,
  SupportedLocale,
} from './interfaces/request-context.interface';

@Injectable()
export class RequestContextService {
  // One AsyncLocalStorage instance shared across the NestJS DI scope.
  // Each request gets its own isolated store via run().
  private readonly storage = new AsyncLocalStorage<IRequestContext>();

  public run<T>(context: IRequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  public getContext(): IRequestContext | undefined {
    return this.storage.getStore();
  }

  public get requestId(): string {
    return this.storage.getStore()?.requestId ?? '';
  }

  public get userId(): string | null {
    return this.storage.getStore()?.userId ?? null;
  }

  public get email(): string | null {
    return this.storage.getStore()?.email ?? null;
  }

  public get userRole(): UserRole | null {
    return this.storage.getStore()?.userRole ?? null;
  }

  public get sessionId(): string | null {
    return this.storage.getStore()?.sessionId ?? null;
  }

  public get deviceId(): string | null {
    return this.storage.getStore()?.deviceId ?? null;
  }

  public get ipAddress(): string {
    return this.storage.getStore()?.ipAddress ?? '';
  }

  public get userAgent(): string | null {
    return this.storage.getStore()?.userAgent ?? null;
  }

  public get path(): string {
    return this.storage.getStore()?.path ?? '';
  }

  public get method(): string {
    return this.storage.getStore()?.method ?? '';
  }

  public get lang(): SupportedLocale {
    return this.storage.getStore()?.lang ?? DEFAULT_LOCALE;
  }

  public get activePlatform(): ActivePlatform | null {
    return this.storage.getStore()?.activePlatform ?? null;
  }

  // Called by JwtContextMiddleware after the JWT is verified.
  public setUser(
    userId: string,
    email: string,
    userRole: UserRole,
    sessionId: string,
    deviceId: string | null,
    activePlatform: ActivePlatform,
  ): void {
    const store = this.storage.getStore();
    if (store) {
      store.userId = userId;
      store.email = email;
      store.userRole = userRole;
      store.sessionId = sessionId;
      store.deviceId = deviceId;
      store.activePlatform = activePlatform;
    }
  }
}
