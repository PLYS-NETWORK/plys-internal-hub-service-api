import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

import { ActivePlatform } from '../../../database/enums/active-platform.enum';
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

  public get userRole(): string | null {
    return this.storage.getStore()?.userRole ?? null;
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

  // Called by RequestContextInterceptor after JWT guard validates the token.
  public setUser(
    userId: string,
    userRole: string,
    deviceId: string | null,
    activePlatform: ActivePlatform,
  ): void {
    const store = this.storage.getStore();
    if (store) {
      store.userId = userId;
      store.userRole = userRole;
      store.activePlatform = activePlatform;
      store.deviceId = deviceId;
    }
  }
}
