import {
  collectAiMasterKeyEnvVars,
  collectFeBffSecretEnvVars,
  ENV_SECRET_REGISTRY,
} from './env-secret-registry';
import { SecretType } from './secret-type.enum';
import {
  ISecretValidationIssue,
  ISecretValidationWarning,
  validateAes256GcmKeyBase64,
  validateJwtHmacSecret,
} from './validators';

export interface IEnvSecretsValidationResult {
  readonly issues: ISecretValidationIssue[];
  readonly warnings: ISecretValidationWarning[];
}

function isStrictDeployEnv(deployEnv: string): boolean {
  return deployEnv === 'dev' || deployEnv === 'prod';
}

export function validateEnvSecrets(env: NodeJS.ProcessEnv): IEnvSecretsValidationResult {
  const deployEnv = env.DEPLOY_ENV ?? 'local';
  const strict = isStrictDeployEnv(deployEnv);
  const issues: ISecretValidationIssue[] = [];
  const warnings: ISecretValidationWarning[] = [];

  for (const def of ENV_SECRET_REGISTRY) {
    const value = env[def.envVar] ?? '';

    if (value.length === 0 && def.required) {
      issues.push({ envVar: def.envVar, message: 'must not be empty' });
      continue;
    }

    if (value.length === 0) {
      continue;
    }

    if (def.type === SecretType.JwtHmacSha256) {
      const result = validateJwtHmacSecret(value, def.envVar, strict);
      if (result.issue) issues.push(result.issue);
      if (result.warning) warnings.push(result.warning);
    }
  }

  validateJwtPairSecrets(env, strict, issues);
  validateVersionedAesSecretSet({
    env,
    keyEnvVars: collectAiMasterKeyEnvVars(env),
    keyPrefix: 'AI_KEYS_MASTER_KEY',
    currentVersionEnvVar: 'AI_KEYS_CURRENT_MASTER_VERSION',
    strict,
    issues,
    warnings,
    missingStrictWarningEnvVar: 'AI_KEYS_MASTER_KEY_v1',
    missingStrictWarningMessage:
      'no AI master key configured — AI provider key vault will fail on first use',
  });
  validateVersionedAesSecretSet({
    env,
    keyEnvVars: collectFeBffSecretEnvVars(env),
    keyPrefix: 'FE_BFF_SECRET',
    currentVersionEnvVar: 'FE_BFF_CURRENT_VERSION',
    strict,
    issues,
    warnings,
    missingStrictWarningEnvVar: 'FE_BFF_SECRET_v1',
    missingStrictWarningMessage:
      'no FE BFF secret configured — BFF envelope encryption will fail on first use',
  });

  return { issues, warnings };
}

function validateJwtPairSecrets(
  env: NodeJS.ProcessEnv,
  strict: boolean,
  issues: ISecretValidationIssue[],
): void {
  const accessSecret = env.JWT_ACCESS_SECRET ?? '';
  const refreshSecret = env.JWT_REFRESH_SECRET ?? '';
  if (
    strict &&
    accessSecret.length > 0 &&
    refreshSecret.length > 0 &&
    accessSecret === refreshSecret
  ) {
    issues.push({
      envVar: 'JWT_REFRESH_SECRET',
      message: 'must differ from JWT_ACCESS_SECRET',
    });
  }
}

function validateVersionedAesSecretSet(options: {
  keyEnvVars: string[];
  keyPrefix: string;
  currentVersionEnvVar: string;
  strict: boolean;
  issues: ISecretValidationIssue[];
  warnings: ISecretValidationWarning[];
  missingStrictWarningEnvVar: string;
  missingStrictWarningMessage: string;
  env: NodeJS.ProcessEnv;
}): void {
  const {
    env,
    keyEnvVars,
    keyPrefix,
    currentVersionEnvVar,
    strict,
    issues,
    warnings,
    missingStrictWarningEnvVar,
    missingStrictWarningMessage,
  } = options;

  for (const envVar of keyEnvVars) {
    const value = env[envVar] ?? '';
    const issue = validateAes256GcmKeyBase64(value, envVar);
    if (issue) {
      issues.push({ envVar, message: issue.message });
    }
  }

  const hasAnyKey = keyEnvVars.length > 0;
  const currentVersionRaw = env[currentVersionEnvVar] ?? '0';
  const currentVersion = parseInt(currentVersionRaw, 10);

  if (hasAnyKey) {
    if (!Number.isInteger(currentVersion) || currentVersion <= 0) {
      issues.push({
        envVar: currentVersionEnvVar,
        message: `must be a positive integer when ${keyPrefix}_v<N> is set`,
      });
    } else {
      const currentKeyVar = `${keyPrefix}_v${currentVersion}`;
      const currentKeyValue = env[currentKeyVar] ?? '';
      if (currentKeyValue.length === 0) {
        issues.push({
          envVar: currentKeyVar,
          message: `must be set — ${currentVersionEnvVar}=${currentVersion}`,
        });
      }
    }
  } else if (strict) {
    warnings.push({
      envVar: missingStrictWarningEnvVar,
      message: missingStrictWarningMessage,
    });
  }
}

export function assertEnvSecretsValid(env: NodeJS.ProcessEnv): void {
  const { issues, warnings } = validateEnvSecrets(env);

  for (const warning of warnings) {
    // eslint-disable-next-line no-console
    console.warn(`[config] secret warning (${warning.envVar}): ${warning.message}`);
  }

  if (issues.length === 0) {
    return;
  }

  const lines = issues.map((i) => `  - ${i.envVar}: ${i.message}`);
  throw new Error(
    `Invalid environment secrets (DEPLOY_ENV=${env.DEPLOY_ENV ?? 'local'}):\n${lines.join('\n')}`,
  );
}
