#!/usr/bin/env node
/**
 * Local Docker production simulation — build images and run the full stack on the
 * Compose bridge network (mirrors VPS runtime without PM2/GHCR).
 *
 * Usage:
 *   node scripts/docker-local.mjs infra
 *   node scripts/docker-local.mjs build [--service api-gateway]
 *   node scripts/docker-local.mjs migrate
 *   node scripts/docker-local.mjs up [--detach]
 *   node scripts/docker-local.mjs down
 *   node scripts/docker-local.mjs logs [service]
 *   node scripts/docker-local.mjs ps
 *   node scripts/docker-local.mjs simulate   # build + migrate + up -d
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const COMPOSE_FILES = [
  'docker/docker-compose.yml',
  'docker/docker-compose.apps.yml',
  'docker/docker-compose.local.yml',
];

const BACKEND_SERVICES = [
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

function composeArgs(extra = []) {
  const files = COMPOSE_FILES.flatMap((file) => ['-f', file]);
  return ['compose', ...files, ...extra];
}

function run(cmd, args, { allowFailure = false } = {}) {
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0 && !allowFailure) {
    process.exit(result.status ?? 1);
  }
  return result.status ?? 0;
}

function docker(args, options) {
  return run('docker', composeArgs(args), options);
}

function usage() {
  console.log(`Usage: node scripts/docker-local.mjs <command>

Commands:
  infra              Start postgres + redis only
  build [--service]  Build runtime images (default: all services)
  migrate            Run DB migrations + seeds (one-shot migrate container)
  up [--detach]      Start full stack (backends, then api-gateway)
  down               Stop and remove stack containers
  logs [service]     Follow logs (all services if omitted)
  ps                 Show compose service status
  simulate           build + migrate + up -d (full local prod simulation)
`);
}

function cmdInfra() {
  run('docker', ['compose', '-f', 'docker/docker-compose.yml', 'up', '-d']);
}

function cmdBuild(argv) {
  const serviceIdx = argv.indexOf('--service');
  const service = serviceIdx >= 0 ? argv[serviceIdx + 1] : null;
  if (serviceIdx >= 0 && !service) {
    console.error('Missing value for --service');
    process.exit(1);
  }

  const targets = service ? [service] : [...BACKEND_SERVICES, 'api-gateway', 'migrate'];
  for (const svc of targets) {
    console.log(`\n==> Building ${svc}...`);
    docker(['build', svc]);
  }
}

function cmdMigrate() {
  docker(['--profile', 'migrate', 'run', '--rm', 'migrate']);
}

function cmdUp(argv) {
  const detach = argv.includes('--detach') || argv.includes('-d');

  console.log('==> Starting backend services...');
  docker(['up', ...(detach ? ['-d'] : []), '--remove-orphans', ...BACKEND_SERVICES]);

  console.log('==> Starting api-gateway (waits for gRPC backends inside container)...');
  docker(['up', ...(detach ? ['-d'] : []), '--no-deps', '--remove-orphans', 'api-gateway']);

  if (detach) {
    console.log('\nLocal stack running: http://localhost:3000/api/v1/gateway/health');
  }
}

function cmdDown() {
  docker(['down', '--remove-orphans']);
}

function cmdLogs(argv) {
  const service = argv[0];
  docker(['logs', '-f', ...(service ? [service] : [])]);
}

function cmdPs() {
  docker(['ps']);
}

function cmdSimulate() {
  cmdBuild([]);
  cmdMigrate();
  cmdUp(['--detach']);
}

const [command, ...rest] = process.argv.slice(2);

switch (command) {
  case 'infra':
    cmdInfra();
    break;
  case 'build':
    cmdBuild(rest);
    break;
  case 'migrate':
    cmdMigrate();
    break;
  case 'up':
    cmdUp(rest);
    break;
  case 'down':
    cmdDown();
    break;
  case 'logs':
    cmdLogs(rest);
    break;
  case 'ps':
    cmdPs();
    break;
  case 'simulate':
    cmdSimulate();
    break;
  default:
    usage();
    process.exit(command ? 1 : 0);
}
