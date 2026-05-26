import { Metadata } from '@grpc/grpc-js';
import {
  DEFAULT_LOCALE,
  IRequestContext,
  SupportedLocale,
} from '@plys/libraries/common-nest/modules/request-context/interfaces/request-context.interface';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { ActivePlatform, UserRole } from '@plys/libraries/database/enums';
import { GRPC_METADATA_KEYS } from '@plys/libraries/proto';

function readMetadataValue(metadata: Metadata, key: string): string | undefined {
  const values = metadata.get(key);
  if (!values.length) {
    return undefined;
  }
  const first = values[0];
  return typeof first === 'string' ? first : first.toString();
}

export function buildMetadataFromRequestContext(requestContext: RequestContextService): Metadata {
  const metadata = new Metadata();
  const entries: Array<[string, string | null | undefined]> = [
    [GRPC_METADATA_KEYS.REQUEST_ID, requestContext.requestId],
    [GRPC_METADATA_KEYS.USER_ID, requestContext.userId],
    [GRPC_METADATA_KEYS.USER_EMAIL, requestContext.email],
    [
      GRPC_METADATA_KEYS.USER_ROLE,
      requestContext.userRole ? String(requestContext.userRole) : null,
    ],
    [GRPC_METADATA_KEYS.SESSION_ID, requestContext.sessionId],
    [
      GRPC_METADATA_KEYS.ACTIVE_PLATFORM,
      requestContext.activePlatform ? String(requestContext.activePlatform) : null,
    ],
    [GRPC_METADATA_KEYS.BUSINESS_ID, requestContext.businessId],
    [GRPC_METADATA_KEYS.DEVICE_ID, requestContext.deviceId],
    [GRPC_METADATA_KEYS.LOCALE, requestContext.lang],
    [GRPC_METADATA_KEYS.TIMEZONE, requestContext.timezone],
    [GRPC_METADATA_KEYS.IP_ADDRESS, requestContext.ipAddress],
    [GRPC_METADATA_KEYS.USER_AGENT, requestContext.userAgent],
    [GRPC_METADATA_KEYS.PATH, requestContext.path],
    [GRPC_METADATA_KEYS.METHOD, requestContext.method],
    [GRPC_METADATA_KEYS.IDEMPOTENCY_KEY, requestContext.idempotencyKey],
  ];

  for (const [key, value] of entries) {
    if (value !== null && value !== undefined && value !== '') {
      metadata.set(key, value);
    }
  }

  return metadata;
}

export function readRequestContextFromMetadata(metadata: Metadata): IRequestContext {
  const lang = readMetadataValue(metadata, GRPC_METADATA_KEYS.LOCALE);
  const role = readMetadataValue(metadata, GRPC_METADATA_KEYS.USER_ROLE);
  const platform = readMetadataValue(metadata, GRPC_METADATA_KEYS.ACTIVE_PLATFORM);

  return {
    requestId: readMetadataValue(metadata, GRPC_METADATA_KEYS.REQUEST_ID) ?? '',
    userId: readMetadataValue(metadata, GRPC_METADATA_KEYS.USER_ID) ?? null,
    email: readMetadataValue(metadata, GRPC_METADATA_KEYS.USER_EMAIL) ?? null,
    userRole: role ? (role as UserRole) : null,
    sessionId: readMetadataValue(metadata, GRPC_METADATA_KEYS.SESSION_ID) ?? null,
    activePlatform: platform ? (platform as ActivePlatform) : null,
    businessId: readMetadataValue(metadata, GRPC_METADATA_KEYS.BUSINESS_ID) ?? null,
    deviceId: readMetadataValue(metadata, GRPC_METADATA_KEYS.DEVICE_ID) ?? null,
    ipAddress: readMetadataValue(metadata, GRPC_METADATA_KEYS.IP_ADDRESS) ?? '',
    userAgent: readMetadataValue(metadata, GRPC_METADATA_KEYS.USER_AGENT) ?? null,
    path: readMetadataValue(metadata, GRPC_METADATA_KEYS.PATH) ?? '',
    method: readMetadataValue(metadata, GRPC_METADATA_KEYS.METHOD) ?? '',
    lang: isSupportedLocale(lang) ? lang : DEFAULT_LOCALE,
    timezone: readMetadataValue(metadata, GRPC_METADATA_KEYS.TIMEZONE) ?? null,
    idempotencyKey: readMetadataValue(metadata, GRPC_METADATA_KEYS.IDEMPOTENCY_KEY) ?? null,
  };
}

export function applyMetadataToRequestContext(
  requestContext: RequestContextService,
  metadata: Metadata,
): void {
  const context = readRequestContextFromMetadata(metadata);
  const userId = context.userId;
  if (userId && context.email && context.userRole && context.sessionId && context.activePlatform) {
    requestContext.setUser(
      userId,
      context.email,
      context.userRole,
      context.sessionId,
      context.deviceId,
      context.activePlatform,
      context.businessId,
    );
  }
  if (context.timezone) {
    requestContext.setSessionTimezone(context.timezone);
  }
}

function isSupportedLocale(value: string | undefined): value is SupportedLocale {
  return value === 'en' || value === 'tr';
}
