#!/usr/bin/env node
/**
 * Copy all .proto files from packages/proto into packages/dist/proto so runtime
 * __dirname resolution works for @plys/libraries/proto in Docker and local dist builds.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = fs.existsSync(path.join(process.cwd(), 'packages', 'proto'))
  ? process.cwd()
  : path.join(process.cwd(), '..');

const sourceRoot = path.join(root, 'packages/proto');
const targetRoot = path.join(root, 'packages/dist/proto');

function walkProtoFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkProtoFiles(full, files);
    else if (entry.name.endsWith('.proto')) files.push(full);
  }
  return files;
}

if (!fs.existsSync(sourceRoot)) {
  console.error(`Proto source directory missing: ${sourceRoot}`);
  process.exit(1);
}

if (!fs.existsSync(targetRoot)) {
  console.error(`Proto dist directory missing: ${targetRoot} — run libraries tsc build first`);
  process.exit(1);
}

let copied = 0;
for (const sourceFile of walkProtoFiles(sourceRoot)) {
  const relative = path.relative(sourceRoot, sourceFile);
  const targetFile = path.join(targetRoot, relative);
  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  fs.copyFileSync(sourceFile, targetFile);
  copied += 1;
}

console.log(`Copied ${copied} proto file(s) to packages/dist/proto`);
