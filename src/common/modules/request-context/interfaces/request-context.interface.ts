import { ActivePlatform, UserRole } from '@database/enums';

export type SupportedLocale = 'en' | 'tr';

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'tr'] as const;
export const DEFAULT_LOCALE: SupportedLocale = 'en';

export interface IRequestContext {
  requestId: string;
  userId: string | null;
  email: string | null;
  userRole: UserRole | null;
  sessionId: string | null;
  activePlatform: ActivePlatform | null;
  deviceId: string | null;
  ipAddress: string;
  userAgent: string | null;
  path: string;
  method: string;
  lang: SupportedLocale;
}
