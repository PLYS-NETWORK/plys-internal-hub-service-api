#!/usr/bin/env node
/**
 * Idempotently set IMAGE_TAG_* (and optionally IMAGE_REGISTRY) in a compose .env file.
 *
 * Usage:
 *   node scripts/patch-image-tag.mjs --file .env --service api-gateway --tag develop-abc123
 *   node scripts/patch-image-tag.mjs --file .env --service all --tag develop-abc123 --registry ghcr.io/owner/repo
 */

import fs from 'node:fs';
import path from 'node:path';

const SERVICE_TAG_KEYS = {
  'api-gateway': 'IMAGE_TAG_API_GATEWAY',
  'identity-service': 'IMAGE_TAG_IDENTITY_SERVICE',
  'business-service': 'IMAGE_TAG_BUSINESS_SERVICE',
  'consultant-service': 'IMAGE_TAG_CONSULTANT_SERVICE',
  'internal-admin-service': 'IMAGE_TAG_INTERNAL_ADMIN_SERVICE',
  'internal-task-reviewer-service': 'IMAGE_TAG_INTERNAL_TASK_REVIEWER_SERVICE',
  'finance-service': 'IMAGE_TAG_FINANCE_SERVICE',
  'notifications-service': 'IMAGE_TAG_NOTIFICATIONS_SERVICE',
  'platform-service': 'IMAGE_TAG_PLATFORM_SERVICE',
  'ai-provider-service': 'IMAGE_TAG_AI_PROVIDER_SERVICE',
  migrate: 'IMAGE_TAG_MIGRATE',
};

const ALL_SERVICES = Object.keys(SERVICE_TAG_KEYS);

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for --${key}`);
      }
      args[key] = value;
      i += 1;
    }
  }
  return args;
}

function upsertEnvLine(lines, key, value) {
  const prefix = `${key}=`;
  const index = lines.findIndex((line) => line.startsWith(prefix) || line === key);
  const nextLine = `${key}=${value}`;
  if (index >= 0) {
    lines[index] = nextLine;
  } else {
    lines.push(nextLine);
  }
}

function main() {
  const { file, service, tag, registry } = parseArgs(process.argv);

  if (!file || !service || !tag) {
    console.error(
      'Usage: node scripts/patch-image-tag.mjs --file <path> --service <name|all> --tag <tag> [--registry <registry>]',
    );
    process.exit(1);
  }

  const resolvedFile = path.resolve(file);
  const lines = fs.existsSync(resolvedFile)
    ? fs.readFileSync(resolvedFile, 'utf8').split('\n').filter((line, i, arr) => {
        return i < arr.length - 1 || line.length > 0;
      })
    : [];

  if (registry) {
    upsertEnvLine(lines, 'IMAGE_REGISTRY', registry);
  }

  if (service === 'all') {
    for (const svc of ALL_SERVICES) {
      upsertEnvLine(lines, SERVICE_TAG_KEYS[svc], tag);
    }
  } else if (!SERVICE_TAG_KEYS[service]) {
    console.error(`Unknown service: ${service}. Valid: all, ${ALL_SERVICES.join(', ')}`);
    process.exit(1);
  } else {
    upsertEnvLine(lines, SERVICE_TAG_KEYS[service], tag);
  }

  fs.mkdirSync(path.dirname(resolvedFile), { recursive: true });
  fs.writeFileSync(resolvedFile, `${lines.join('\n')}\n`, 'utf8');

  const updatedKeys =
    service === 'all'
      ? ALL_SERVICES.map((svc) => SERVICE_TAG_KEYS[svc])
      : [SERVICE_TAG_KEYS[service]];

  if (registry) {
    updatedKeys.unshift('IMAGE_REGISTRY');
  }

  console.log(`Updated ${resolvedFile}: ${updatedKeys.join(', ')}`);
}

main();
