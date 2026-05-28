import { IAiKeysVersionedSecrets } from './interfaces/ai-keys-config.interface';
import { FilesStorageProviderName } from './interfaces/files-config.interface';

/** host:port for gRPC clients — explicit *_GRPC_URL wins; else GRPC_HOST + *_GRPC_PORT. */
export function resolveGrpcUrl(
  url: string | undefined,
  port: string | undefined,
  defaultPort: string,
): string {
  if (url) return url;
  const host = process.env.GRPC_HOST ?? '127.0.0.1';
  return `${host}:${port ?? defaultPort}`;
}

export function collectVersionedKeys(prefix: string): Record<number, string> {
  const out: Record<number, string> = {};
  const pattern = new RegExp(`^${prefix}_v(\\d+)$`);
  for (const name of Object.keys(process.env)) {
    const match = pattern.exec(name);
    if (!match) continue;
    const value = process.env[name];
    if (typeof value === 'string' && value.length > 0) {
      out[parseInt(match[1], 10)] = value;
    }
  }
  return out;
}

export function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export function parseIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return parseInt(raw, 10);
}

export function parseBoolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw === 'true';
}

export function getDeployEnv(): string {
  return process.env.DEPLOY_ENV ?? 'local';
}

export function isStrictDeploy(): boolean {
  const deployEnv = getDeployEnv();
  return deployEnv === 'dev' || deployEnv === 'prod';
}

export function getAllowedOrigins(): string[] {
  const isStrict = isStrictDeploy();
  const allowedOriginsRaw = process.env.ALLOWED_ORIGINS?.split(',').filter(
    (origin) => origin.length > 0,
  );
  if (isStrict && (!allowedOriginsRaw || allowedOriginsRaw.length === 0)) {
    throw new Error('ALLOWED_ORIGINS must be set in dev/prod (comma-separated, no wildcard)');
  }
  return allowedOriginsRaw ?? ['*'];
}

export function getJwtStrictClaims(): boolean {
  const isStrict = isStrictDeploy();
  return (
    process.env.JWT_STRICT_CLAIMS === 'true' ||
    (isStrict && process.env.JWT_STRICT_CLAIMS !== 'false')
  );
}

export function getFilesStorageProvider(): FilesStorageProviderName {
  return (process.env.FILES_STORAGE_PROVIDER ?? 'local') as FilesStorageProviderName;
}

export function getFilesAllowedMimeList(): string[] {
  return (
    process.env.FILES_ALLOWED_MIME?.split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0) ?? ['image/png', 'image/jpeg', 'application/pdf']
  );
}

export function getPolarServer(): 'sandbox' | 'production' {
  return (process.env.POLAR_SERVER ?? 'sandbox') as 'sandbox' | 'production';
}

export function getAiKeysMaster(): IAiKeysVersionedSecrets {
  return {
    currentVersion: parseIntEnv('AI_KEYS_CURRENT_MASTER_VERSION', 0),
    versions: collectVersionedKeys('AI_KEYS_MASTER_KEY'),
  };
}

export function getAiKeysBff(): IAiKeysVersionedSecrets {
  return {
    currentVersion: parseIntEnv('FE_BFF_CURRENT_VERSION', 0),
    versions: collectVersionedKeys('FE_BFF_SECRET'),
  };
}

export function getRedisPassword(): string | undefined {
  return process.env.REDIS_PASSWORD || undefined;
}

export function getFilesMaxImagePixels(): number | null {
  return process.env.FILES_MAX_IMAGE_PIXELS
    ? parseInt(process.env.FILES_MAX_IMAGE_PIXELS, 10)
    : null;
}

export function getAwsS3Endpoint(): string {
  return process.env.AWS_S3_ENDPOINT ?? '';
}

export function getGoogleClientId(): string | undefined {
  const v = process.env.GOOGLE_CLIENT_ID;
  return v && v.length > 0 ? v : undefined;
}

export function getGoogleClientSecret(): string | undefined {
  const v = process.env.GOOGLE_CLIENT_SECRET;
  return v && v.length > 0 ? v : undefined;
}

export function getGoogleCallbackUrl(): string | undefined {
  const v = process.env.GOOGLE_CALLBACK_URL;
  return v && v.length > 0 ? v : undefined;
}

export function getCorsAllowLocalhost(): boolean {
  return getDeployEnv() === 'dev' && process.env.CORS_ALLOW_LOCALHOST === 'true';
}
