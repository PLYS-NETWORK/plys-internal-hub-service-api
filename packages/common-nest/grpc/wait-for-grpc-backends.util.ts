import * as net from 'node:net';

const DEFAULT_PORTS = {
  identity: '5001',
  profiles: '5002',
  projects: '5003',
  finance: '5004',
  platform: '5005',
} as const;

export interface IGrpcBackendTarget {
  name: string;
  host: string;
  port: number;
}

export interface IWaitForGrpcBackendsOptions {
  timeoutMs?: number;
  intervalMs?: number;
  probeTimeoutMs?: number;
}

function parseGrpcTarget(
  url: string | undefined,
  host: string,
  port: string | undefined,
): { host: string; port: number } {
  if (url) {
    const normalized = url.includes('://') ? url : `grpc://${url}`;
    try {
      const parsed = new URL(normalized);
      return {
        host: parsed.hostname || host,
        port: Number.parseInt(parsed.port || port || '0', 10),
      };
    } catch {
      const [h, p] = url.split(':');
      return {
        host: h || host,
        port: Number.parseInt(p || port || '0', 10),
      };
    }
  }
  return { host, port: Number.parseInt(port ?? '0', 10) };
}

/** Resolve backend gRPC TCP targets from process.env (Docker env_file / VPS .env). */
export function resolveGrpcBackendTargetsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): IGrpcBackendTarget[] {
  const host = env.GRPC_HOST || '127.0.0.1';
  const entries: Array<[string, string | undefined, string | undefined]> = [
    ['identity-service', env.IDENTITY_GRPC_URL, env.IDENTITY_GRPC_PORT ?? DEFAULT_PORTS.identity],
    ['profiles-service', env.PROFILES_GRPC_URL, env.PROFILES_GRPC_PORT ?? DEFAULT_PORTS.profiles],
    ['projects-service', env.PROJECTS_GRPC_URL, env.PROJECTS_GRPC_PORT ?? DEFAULT_PORTS.projects],
    ['finance-service', env.FINANCE_GRPC_URL, env.FINANCE_GRPC_PORT ?? DEFAULT_PORTS.finance],
    ['platform-service', env.PLATFORM_GRPC_URL, env.PLATFORM_GRPC_PORT ?? DEFAULT_PORTS.platform],
  ];

  return entries.map(([name, url, port]) => {
    const target = parseGrpcTarget(url, host, port);
    return { name, host: target.host, port: target.port };
  });
}

function probePort(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok: boolean): void => {
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Block until all backend gRPC ports accept TCP connections. */
export async function waitForGrpcBackendsFromProcessEnv(
  options: IWaitForGrpcBackendsOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const intervalMs = options.intervalMs ?? 2_000;
  const probeTimeoutMs = options.probeTimeoutMs ?? 1_500;
  const targets = resolveGrpcBackendTargetsFromEnv();

  const deadline = Date.now() + timeoutMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt += 1;
    const results = await Promise.all(
      targets.map(async (target) => ({
        target,
        ok: await probePort(target.host, target.port, probeTimeoutMs),
      })),
    );
    const pending = results.filter((r) => !r.ok);
    if (pending.length === 0) {
      // eslint-disable-next-line no-console
      console.log(`gRPC backends ready (attempt ${attempt})`);
      return;
    }
    const summary = pending
      .map(({ target }) => `${target.name}@${target.host}:${target.port}`)
      .join(', ');
    // eslint-disable-next-line no-console
    console.log(`Waiting for gRPC backends (attempt ${attempt}): ${summary}`);
    await sleep(intervalMs);
  }

  const summary = targets.map((t) => `${t.name}@${t.host}:${t.port}`).join(', ');
  throw new Error(`Timed out after ${timeoutMs}ms waiting for gRPC backends: ${summary}`);
}
