#!/usr/bin/env node
/**
 * Point @plys/libraries package exports at compiled dist/*.js for Docker runtime.
 * Dev workspace exports target TypeScript sources; Node in containers needs dist output.
 */
import fs from 'node:fs';
import path from 'node:path';

const pkgPath = path.resolve('packages/package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

pkg.exports = {
  './proto': './dist/proto/index.js',
  './proto/health.proto': './proto/common/v1/health.proto',
  './shared-kernel': './dist/shared-kernel/index.js',
  './database': './dist/database/index.js',
  './database/*': './dist/database/*',
  './config': './dist/config/index.js',
  './config/*': './dist/config/*',
  './common-nest/*': './dist/common-nest/*',
  './unit-of-work': './dist/unit-of-work/unit-of-work.module.js',
  './unit-of-work/*': './dist/unit-of-work/*',
  './ai-provider-key': './dist/ai-provider-key/index.js',
  './notifications': './dist/notifications/index.js',
  './profiles-port': './dist/profiles-port/index.js',
};

fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log('Patched packages/package.json exports for runtime (dist/*.js)');
