#!/usr/bin/env node
/**
 * Merge committed .env.dev / .env.prod templates with secrets from process.env.
 * Usage: node scripts/render-deploy-env.mjs --deploy-env dev|prod [--output path]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function parseArgs(argv) {
  let deployEnv = null;
  let output = null;
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--deploy-env' && argv[i + 1]) {
      deployEnv = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--output' && argv[i + 1]) {
      output = argv[i + 1];
      i += 1;
    }
  }
  if (!deployEnv || !['dev', 'prod'].includes(deployEnv)) {
    console.error('Usage: node scripts/render-deploy-env.mjs --deploy-env dev|prod [--output path]');
    process.exit(1);
  }
  return {
    deployEnv,
    output: output ?? path.join(root, 'deploy', `.env.${deployEnv}`),
  };
}

function loadSecretKeys() {
  const listPath = path.join(root, 'scripts', 'env-secrets.list');
  return fs
    .readFileSync(listPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

function setEnvLine(content, key, value) {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  const line = `${key}="${escaped}"`;
  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }
  return `${content.trimEnd()}\n${line}\n`;
}

const { deployEnv, output } = parseArgs(process.argv);
const templatePath = path.join(root, `.env.${deployEnv}`);

if (!fs.existsSync(templatePath)) {
  console.error(`Template not found: ${templatePath}`);
  process.exit(1);
}

let content = fs.readFileSync(templatePath, 'utf8');
const secretKeys = loadSecretKeys();
const missing = [];

for (const key of secretKeys) {
  const value = process.env[key];
  if (value === undefined || value === '') {
    missing.push(key);
    continue;
  }
  content = setEnvLine(content, key, value);
}

if (missing.length > 0) {
  console.error(`Missing required secrets: ${missing.join(', ')}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, content, 'utf8');
console.log(`Wrote ${output}`);
