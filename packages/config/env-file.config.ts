import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Walk up from cwd to find the monorepo root (directory containing pnpm-workspace.yaml).
 */
function resolveWorkspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/**
 * Resolves the .env file path based on DEPLOY_ENV (not NODE_ENV).
 * Env files live at the monorepo root so all apps share one configuration.
 * - prod  → .env.prod
 * - dev   → .env.dev
 * - local → .env.local (fallback: .env for migration)
 */
export function resolveEnvFilePath(): string {
  const root = resolveWorkspaceRoot();
  const deployEnv = process.env.DEPLOY_ENV ?? 'local';

  if (deployEnv === 'prod') return path.join(root, 'env', '.env.prod');
  if (deployEnv === 'dev') return path.join(root, 'env', '.env.dev');
  if (deployEnv === 'docker') return path.join(root, 'env', '.env.docker');

  const localPath = path.join(root, 'env', '.env.local');
  if (fs.existsSync(localPath)) return localPath;

  const legacyLocal = path.join(root, '.env.local');
  if (fs.existsSync(legacyLocal)) return legacyLocal;

  const examplePath = path.join(root, 'env', '.env.example');
  if (fs.existsSync(examplePath)) return examplePath;

  return path.join(root, '.env');
}
