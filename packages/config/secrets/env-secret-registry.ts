import { SecretType } from './secret-type.enum';

export interface IEnvSecretDefinition {
  readonly envVar: string;
  readonly type: SecretType;
  readonly label: string;
  /** When true, an empty value is rejected even in relaxed (local) mode. */
  readonly required: boolean;
}

/** Known placeholder values rejected in strict (dev/prod) validation. */
export const PLACEHOLDER_SECRETS = new Set([
  'change-me',
  'change-me-too',
  'changeme',
  'secret',
  'your_password',
]);

export const ENV_SECRET_REGISTRY: readonly IEnvSecretDefinition[] = [
  {
    envVar: 'JWT_ACCESS_SECRET',
    type: SecretType.JwtHmacSha256,
    label: 'JWT access token signing key',
    required: true,
  },
  {
    envVar: 'JWT_REFRESH_SECRET',
    type: SecretType.JwtHmacSha256,
    label: 'JWT refresh token signing key',
    required: true,
  },
];

/** Collects non-empty AI_KEYS_MASTER_KEY_v<N> env var names present in env. */
export function collectAiMasterKeyEnvVars(env: NodeJS.ProcessEnv): string[] {
  return collectVersionedSecretEnvVars(env, 'AI_KEYS_MASTER_KEY');
}

/** Collects non-empty FE_BFF_SECRET_v<N> env var names present in env. */
export function collectFeBffSecretEnvVars(env: NodeJS.ProcessEnv): string[] {
  return collectVersionedSecretEnvVars(env, 'FE_BFF_SECRET');
}

function collectVersionedSecretEnvVars(env: NodeJS.ProcessEnv, prefix: string): string[] {
  const pattern = new RegExp(`^${prefix}_v(\\d+)$`);
  return Object.keys(env).filter((name) => {
    if (!pattern.test(name)) return false;
    const value = env[name];
    return typeof value === 'string' && value.length > 0;
  });
}
