import * as path from 'path';

/** Absolute path to the health.proto file for @grpc/proto-loader. */
export const HEALTH_PROTO_PATH = path.join(__dirname, 'common/v1/health.proto');

export const HTTP_PROTO_PATH = path.join(__dirname, 'common/v1/http.proto');

export const IDENTITY_PROTO_PATH = path.join(__dirname, 'identity/v1/identity.proto');

export const PROFILES_PROTO_PATH = path.join(__dirname, 'profiles/v1/profiles.proto');

export const PROJECTS_PROTO_PATH = path.join(__dirname, 'projects/v1/projects.proto');

export const FINANCE_PROTO_PATH = path.join(__dirname, 'finance/v1/finance.proto');

export const PLATFORM_PROTO_PATH = path.join(__dirname, 'platform/v1/platform.proto');

/** Proto paths required when loading a domain package that imports http.proto. */
export const DOMAIN_PROTO_PATHS = {
  IDENTITY: [HTTP_PROTO_PATH, IDENTITY_PROTO_PATH],
  PROFILES: [HTTP_PROTO_PATH, PROFILES_PROTO_PATH],
  PROJECTS: [HTTP_PROTO_PATH, PROJECTS_PROTO_PATH],
  FINANCE: [HTTP_PROTO_PATH, FINANCE_PROTO_PATH],
  PLATFORM: [HTTP_PROTO_PATH, PLATFORM_PROTO_PATH],
} as const;

export const GRPC_PACKAGES = {
  HEALTH: 'grpc.health.v1',
  COMMON: 'common.v1',
  IDENTITY: 'identity.v1',
  PROFILES: 'profiles.v1',
  PROJECTS: 'projects.v1',
  FINANCE: 'finance.v1',
  PLATFORM: 'platform.v1',
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
} as const;
