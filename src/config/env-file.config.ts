/**
 * Resolves the .env file path based on the current NODE_ENV.
 * - production  → .env.production
 * - development → .env.development
 * - local / any → .env
 */
export function resolveEnvFilePath(): string {
  const env = process.env.NODE_ENV;
  if (env === 'production') return '.env.production';
  if (env === 'development') return '.env.development';
  return '.env';
}
