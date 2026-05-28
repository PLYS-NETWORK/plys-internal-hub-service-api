#!/usr/bin/env node
/**
 * Copy email .ejs templates next to compiled template loaders.
 * Nest/tsc emit .js for template/*.template.ts but not the peer .ejs files.
 */
import fs from 'node:fs';
import path from 'node:path';

function walkEjsFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkEjsFiles(full, files);
    else if (entry.name.endsWith('.ejs')) files.push(full);
  }
  return files;
}

function copyTemplates(sourceRoot, targetRoot) {
  let copied = 0;
  for (const sourceFile of walkEjsFiles(sourceRoot)) {
    const relative = path.relative(sourceRoot, sourceFile);
    const targetFile = path.join(targetRoot, relative);
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.copyFileSync(sourceFile, targetFile);
    copied += 1;
  }
  return copied;
}

function resolveRoots() {
  const cwd = process.cwd();

  const packagesSource = path.join(cwd, 'common-nest/modules/email/templates');
  if (fs.existsSync(packagesSource)) {
    return {
      sourceRoot: packagesSource,
      targetRoot: path.join(cwd, 'dist/common-nest/modules/email/templates'),
      label: 'packages/dist',
    };
  }

  const serviceSource = path.join(cwd, '../../packages/common-nest/modules/email/templates');
  const serviceBundledDir = path.join(
    cwd,
    'dist/packages/common-nest/modules/email/templates',
  );
  if (fs.existsSync(serviceSource)) {
    return {
      sourceRoot: serviceSource,
      targetRoot: serviceBundledDir,
      label: path.basename(cwd),
      skipWhenMissingBundledDir: true,
    };
  }

  const repoRoot = fs.existsSync(path.join(cwd, 'packages/common-nest/modules/email/templates'))
    ? cwd
    : null;
  if (repoRoot) {
    return {
      sourceRoot: path.join(repoRoot, 'packages/common-nest/modules/email/templates'),
      targetRoot: path.join(repoRoot, 'packages/dist/common-nest/modules/email/templates'),
      label: 'packages/dist (repo root)',
    };
  }

  console.error(
    'Could not resolve email template paths — run from packages/, apps/<service>/, or repo root',
  );
  process.exit(1);
}

const { sourceRoot, targetRoot, label, skipWhenMissingBundledDir } = resolveRoots();

if (!fs.existsSync(sourceRoot)) {
  console.error(`Email template source missing: ${sourceRoot}`);
  process.exit(1);
}

if (skipWhenMissingBundledDir && !fs.existsSync(targetRoot)) {
  console.log(`No bundled email templates in ${label} dist — skipping ejs copy`);
  process.exit(0);
}

const copied = copyTemplates(sourceRoot, targetRoot);
console.log(`Copied ${copied} email template(s) to ${path.relative(process.cwd(), targetRoot)} (${label})`);
