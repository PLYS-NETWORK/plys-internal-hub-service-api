#!/usr/bin/env node
/**
 * Block until backend gRPC ports accept TCP connections (VPS host networking).
 * Used before starting api-gateway so the first upstream call does not fail with ECONNREFUSED.
 *
 * Usage: node scripts/wait-for-grpc-backends.mjs --env-file .env.dev [--timeout-ms 120000]
 */
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_PORTS = {
  identity: '5001',
  profiles: '5002',
  projects: '5003',
  finance: '5004',
  platform: '5005',
};

function parseArgs(argv) {
  let envFile = null;
  let timeoutMs = 120_000;
  let intervalMs = 2_000;
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--env-file' && argv[i + 1]) {
      envFile = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--timeout-ms' && argv[i + 1]) {
      timeoutMs = Number.parseInt(argv[i + 1], 10);
      i += 1;
    } else if (argv[i] === '--interval-ms' && argv[i + 1]) {
      intervalMs = Number.parseInt(argv[i + 1], 10);
      i += 1;
    }
  }
  if (!envFile) {
    console.error('Usage: node scripts/wait-for-grpc-backends.mjs --env-file .env.dev');
    process.exit(1);
  }
  return { envFile, timeoutMs, intervalMs };
}

function stripEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnvFile(filePath) {
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`Env file not found: ${resolved}`);
    process.exit(1);
  }
  const out = {};
  for (const line of fs.readFileSync(resolved, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    out[trimmed.slice(0, eq).trim()] = stripEnvValue(trimmed.slice(eq + 1));
  }
  return out;
}

function parseGrpcTarget(url, host, port) {
  if (url) {
    const normalized = url.includes('://') ? url : `grpc://${url}`;
    try {
      const parsed = new URL(normalized);
      return {
        host: parsed.hostname || host,
        port: parsed.port || port,
      };
    } catch {
      const [h, p] = url.split(':');
      return { host: h || host, port: p || port };
    }
  }
  return { host, port };
}

function resolveTargets(env) {
  const host = env.GRPC_HOST || '127.0.0.1';
  return [
    {
      name: 'identity-service',
      ...parseGrpcTarget(env.IDENTITY_GRPC_URL, host, env.IDENTITY_GRPC_PORT ?? DEFAULT_PORTS.identity),
    },
    {
      name: 'profiles-service',
      ...parseGrpcTarget(env.PROFILES_GRPC_URL, host, env.PROFILES_GRPC_PORT ?? DEFAULT_PORTS.profiles),
    },
    {
      name: 'projects-service',
      ...parseGrpcTarget(env.PROJECTS_GRPC_URL, host, env.PROJECTS_GRPC_PORT ?? DEFAULT_PORTS.projects),
    },
    {
      name: 'finance-service',
      ...parseGrpcTarget(env.FINANCE_GRPC_URL, host, env.FINANCE_GRPC_PORT ?? DEFAULT_PORTS.finance),
    },
    {
      name: 'platform-service',
      ...parseGrpcTarget(env.PLATFORM_GRPC_URL, host, env.PLATFORM_GRPC_PORT ?? DEFAULT_PORTS.platform),
    },
  ];
}

function probePort(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port: Number.parseInt(String(port), 10) });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

async function waitForTargets(targets, timeoutMs, intervalMs) {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    const results = await Promise.all(
      targets.map(async (target) => ({
        target,
        ok: await probePort(target.host, target.port, 1_500),
      })),
    );
    const pending = results.filter((r) => !r.ok);
    if (pending.length === 0) {
      console.log(`gRPC backends ready (attempt ${attempt})`);
      return;
    }
    const summary = pending
      .map(({ target }) => `${target.name}@${target.host}:${target.port}`)
      .join(', ');
    console.log(`Waiting for gRPC backends (attempt ${attempt}): ${summary}`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  const summary = targets.map((t) => `${t.name}@${t.host}:${t.port}`).join(', ');
  console.error(`Timed out after ${timeoutMs}ms waiting for gRPC backends: ${summary}`);
  console.error(
    'Backends never opened their gRPC ports — check container logs (secret validation, DB/Redis, i18n).',
  );
  process.exit(1);
}

const { envFile, timeoutMs, intervalMs } = parseArgs(process.argv);
const targets = resolveTargets(loadEnvFile(envFile));
console.log(
  `Waiting for gRPC backends from ${envFile}: ${targets.map((t) => `${t.host}:${t.port}`).join(', ')}`,
);
await waitForTargets(targets, timeoutMs, intervalMs);
