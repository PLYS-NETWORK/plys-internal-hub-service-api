export type SupportedLocale = 'en' | 'tr';

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'tr'] as const;
export const DEFAULT_LOCALE: SupportedLocale = 'en';

import { ActivePlatform } from '@database/enums/active-platform.enum';

export interface IRequestContext {
  requestId: string;
  userId: string | null;
  userRole: string | null;
  activePlatform: ActivePlatform | null;
  deviceId: string | null;
  ipAddress: string;
  userAgent: string | null;
  path: string;
  method: string;
  lang: SupportedLocale;
}
