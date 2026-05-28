import * as fs from 'node:fs';
import * as path from 'node:path';

function resolveProtoFile(...segments: string[]): string {
  const relative = path.join(...segments);
  const candidates = [
    path.join(__dirname, relative),
    path.join(process.cwd(), 'packages/proto', relative),
    path.join(__dirname, '..', '..', 'proto', relative),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}

/** Absolute path to the health.proto file for @grpc/proto-loader. */
export const HEALTH_PROTO_PATH = resolveProtoFile('common', 'v1', 'health.proto');

export const HTTP_PROTO_PATH = resolveProtoFile('common', 'v1', 'http.proto');

export function resolveHttpProtoPath(): string {
  return resolveProtoFile('common', 'v1', 'http.proto');
}

export function resolveNotificationsProtoPath(): string {
  return resolveProtoFile('notifications', 'v1', 'notifications.proto');
}

export const IDENTITY_PROTO_PATH = resolveProtoFile('identity', 'v1', 'identity.proto');

export const PROFILES_PROTO_PATH = resolveProtoFile('profiles', 'v1', 'profiles.proto');

export const PROJECTS_PROTO_PATH = resolveProtoFile('projects', 'v1', 'projects.proto');

export const FINANCE_PROTO_PATH = resolveProtoFile('finance', 'v1', 'finance.proto');

export const PLATFORM_PROTO_PATH = resolveProtoFile('platform', 'v1', 'platform.proto');

export const NOTIFICATIONS_PROTO_PATH = resolveProtoFile(
  'notifications',
  'v1',
  'notifications.proto',
);

export const AIPROVIDER_PROTO_PATH = resolveProtoFile('aiprovider', 'v1', 'aiprovider.proto');

export const BUSINESS_PROTO_PATH = resolveProtoFile('business', 'v1', 'business.proto');

export const CONSULTANT_PROTO_PATH = resolveProtoFile('consultant', 'v1', 'consultant.proto');

export const INTERNAL_ADMIN_PROTO_PATH = resolveProtoFile(
  'internal-admin',
  'v1',
  'internal-admin.proto',
);

export const INTERNAL_TASK_REVIEWER_PROTO_PATH = resolveProtoFile(
  'internal-task-reviewer',
  'v1',
  'internal-task-reviewer.proto',
);

/** Proto paths required when loading a domain package that imports http.proto. */
export const DOMAIN_PROTO_PATHS = {
  IDENTITY: [HTTP_PROTO_PATH, IDENTITY_PROTO_PATH],
  PROFILES: [HTTP_PROTO_PATH, PROFILES_PROTO_PATH],
  PROJECTS: [HTTP_PROTO_PATH, PROJECTS_PROTO_PATH],
  FINANCE: [HTTP_PROTO_PATH, FINANCE_PROTO_PATH],
  PLATFORM: [HTTP_PROTO_PATH, PLATFORM_PROTO_PATH],
  NOTIFICATIONS: [HTTP_PROTO_PATH, NOTIFICATIONS_PROTO_PATH],
  AIPROVIDER: [HTTP_PROTO_PATH, AIPROVIDER_PROTO_PATH],
  BUSINESS: [HTTP_PROTO_PATH, BUSINESS_PROTO_PATH],
  CONSULTANT: [HTTP_PROTO_PATH, CONSULTANT_PROTO_PATH],
  INTERNAL_ADMIN: [HTTP_PROTO_PATH, INTERNAL_ADMIN_PROTO_PATH],
  INTERNAL_TASK_REVIEWER: [HTTP_PROTO_PATH, INTERNAL_TASK_REVIEWER_PROTO_PATH],
} as const;

export const GRPC_PACKAGES = {
  HEALTH: 'grpc.health.v1',
  COMMON: 'common.v1',
  IDENTITY: 'identity.v1',
  PROFILES: 'profiles.v1',
  PROJECTS: 'projects.v1',
  FINANCE: 'finance.v1',
  PLATFORM: 'platform.v1',
  NOTIFICATIONS: 'notifications.v1',
  AIPROVIDER: 'aiprovider.v1',
  BUSINESS: 'business.v1',
  CONSULTANT: 'consultant.v1',
  INTERNAL_ADMIN: 'internal_admin.v1',
  INTERNAL_TASK_REVIEWER: 'internal_task_reviewer.v1',
} as const;

export const GRPC_METADATA_KEYS = {
  REQUEST_ID: 'x-request-id',
  USER_ID: 'x-user-id',
  USER_EMAIL: 'x-user-email',
  USER_ROLE: 'x-user-role',
  SESSION_ID: 'x-session-id',
  ACTIVE_PLATFORM: 'x-active-platform',
  BUSINESS_ID: 'x-business-id',
  DEVICE_ID: 'x-device-id',
  LOCALE: 'x-locale',
  TIMEZONE: 'x-timezone',
  IP_ADDRESS: 'x-ip-address',
  USER_AGENT: 'x-user-agent',
  PATH: 'x-path',
  METHOD: 'x-method',
  IDEMPOTENCY_KEY: 'idempotency-key',
  /** Shared secret proving the caller is the trusted API gateway. */
  SERVICE_AUTH: 'x-grpc-service-auth',
} as const;
