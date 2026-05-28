#!/usr/bin/env node
/**
 * Type-check all NestJS apps. Single source of truth for CI and local `pnpm typecheck:apps`.
 */
const APPS = [
  'api-gateway',
  'identity-service',
  'business-service',
  'consultant-service',
  'internal-admin-service',
  'internal-task-reviewer-service',
  'finance-service',
  'notifications-service',
  'platform-service',
  'ai-provider-service',
];

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

for (const app of APPS) {
  const tsconfig = path.join(root, 'apps', app, 'tsconfig.json');
  if (!fs.existsSync(tsconfig)) {
    console.warn(`skip ${app} (no tsconfig yet)`);
    continue;
  }
  console.log(`==> tsc ${app}`);
  execSync(`pnpm exec tsc --noEmit -p "${tsconfig}"`, { stdio: 'inherit', cwd: root });
}

console.log('All app type checks passed.');
