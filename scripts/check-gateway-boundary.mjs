#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const gatewaySrc = path.join(root, 'apps/api-gateway/src');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (entry.isFile() && full.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

const violations = [];
const modulesImportPattern = /\bimport(?:\s+type)?[\s\S]*?\sfrom\s*['"](@modules\/[^'"]+)['"]/g;
for (const file of walk(gatewaySrc)) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(modulesImportPattern)) {
    violations.push({
      file,
      modulePath: match[1],
      importLine: match[0].replace(/\s+/g, ' ').trim(),
    });
  }
}

if (violations.length > 0) {
  console.error('Gateway boundary violation: @modules/* import detected in api-gateway.\n');
  for (const violation of violations) {
    console.error('- ' + path.relative(root, violation.file));
    console.error('  path: ' + violation.modulePath);
    console.error('  import: ' + violation.importLine);
  }
  process.exit(1);
}

console.log('Gateway boundary check passed: no @modules/* imports in api-gateway.');
