#!/usr/bin/env node
/**
 * Fail the Docker build if compiled output references modules that won't resolve
 * at runtime (same NODE_PATH layout as docker-entrypoint.sh).
 */
import fs from 'node:fs';
import Module, { createRequire } from 'node:module';
import path from 'node:path';

const root = process.cwd();
const RUNTIME_SERVICES = [
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

function collectNodePathDirs() {
  const dirs = [
    path.join(root, 'node_modules'),
    path.join(root, 'packages/node_modules'),
  ];
  for (const service of RUNTIME_SERVICES) {
    const appModules = path.join(root, 'apps', service, 'node_modules');
    if (fs.existsSync(appModules)) dirs.push(appModules);
  }
  return dirs.filter((dir) => fs.existsSync(dir));
}

function walkJsFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsFiles(full, files);
    else if (entry.name.endsWith('.js') && !entry.name.endsWith('.spec.js')) files.push(full);
  }
  return files;
}

function extractRequires(source) {
  const reqs = new Set();
  const patterns = [
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /from\s+['"]([^'"]+)['"]/g,
  ];
  for (const re of patterns) {
    let match;
    while ((match = re.exec(source)) !== null) {
      reqs.add(match[1]);
    }
  }
  return [...reqs];
}

function findTypeScriptRuntimeRequires(scanRoots) {
  const hits = [];
  for (const scanRoot of scanRoots) {
    for (const file of walkJsFiles(scanRoot)) {
      const source = fs.readFileSync(file, 'utf8');
      for (const request of extractRequires(source)) {
        if (request.endsWith('.ts')) {
          hits.push({ fromFile: file, request });
        }
      }
    }
  }
  return hits;
}

function resolvePlysExport(subpath) {
  const pkgPath = path.join(root, 'packages/package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const exactKey = `./${subpath}`;
  let target = pkg.exports[exactKey];
  if (!target) {
    for (const [exportKey, exportTarget] of Object.entries(pkg.exports)) {
      if (!exportKey.endsWith('/*')) continue;
      const prefix = exportKey.slice(0, -1);
      if (exactKey.startsWith(prefix)) {
        target = exportTarget.replace('*', exactKey.slice(prefix.length));
        break;
      }
    }
  }
  if (!target) return { ok: false, reason: `no export for @plys/libraries/${subpath}` };
  const filePath = path.join(root, 'packages', target.replace(/^\.\//, ''));
  const candidates = [filePath, `${filePath}.js`, path.join(filePath, 'index.js')];
  if (candidates.some((candidate) => fs.existsSync(candidate))) {
    return { ok: true };
  }
  return { ok: false, reason: `export target missing on disk: packages/${target}` };
}

function verifyRequire(fromFile, request) {
  if (request.startsWith('node:')) return null;
  if (request.startsWith('.')) return null;

  if (request === '@plys/libraries' || request.startsWith('@plys/libraries/')) {
    const subpath = request === '@plys/libraries' ? '' : request.slice('@plys/libraries/'.length);
    if (!subpath) return null;
    const result = resolvePlysExport(subpath);
    return result.ok ? null : { fromFile, request, reason: result.reason };
  }

  const nodePath = collectNodePathDirs().join(path.delimiter);
  const previous = process.env.NODE_PATH;
  process.env.NODE_PATH = nodePath;
  Module._initPaths();
  const req = Module.createRequire(fromFile);
  try {
    req.resolve(request);
    return null;
  } catch (error) {
    return {
      fromFile,
      request,
      reason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    process.env.NODE_PATH = previous;
    Module._initPaths();
  }
}

const failures = [];
const scanRoots = [
  path.join(root, 'packages/dist'),
  ...RUNTIME_SERVICES.map((service) =>
    path.join(root, 'apps', service, 'dist'),
  ),
];

for (const service of RUNTIME_SERVICES) {
  const mainJs = path.join(
    root,
    'apps',
    service,
    'dist',
    'apps',
    service,
    'src',
    'main.js',
  );
  if (!fs.existsSync(mainJs)) {
    failures.push({
      fromFile: mainJs,
      request: '(entrypoint)',
      reason: 'service main.js missing — check nest build output path',
    });
  }
}

for (const scanRoot of scanRoots) {
  for (const file of walkJsFiles(scanRoot)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const request of extractRequires(source)) {
      const failure = verifyRequire(file, request);
      if (failure) failures.push(failure);
    }
  }
}

const tsRequires = findTypeScriptRuntimeRequires(scanRoots);
for (const hit of tsRequires) {
  failures.push({
    fromFile: hit.fromFile,
    request: hit.request,
    reason: 'compiled output must not require .ts paths — fix tsconfig path alias target',
  });
}

const requiredProtoFiles = [
  'packages/dist/proto/common/v1/http.proto',
  'packages/proto/common/v1/http.proto',
];
for (const relativePath of requiredProtoFiles) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    failures.push({
      fromFile: filePath,
      request: relativePath,
      reason: 'gRPC proto file missing — ensure libraries build copies proto/*.proto into dist/proto',
    });
  }
}

const protoIndexJs = path.join(root, 'packages/dist/proto/index.js');
if (fs.existsSync(protoIndexJs)) {
  const protoExports = createRequire(import.meta.url)(protoIndexJs);
  const httpProtoPath = protoExports.HTTP_PROTO_PATH;
  if (typeof httpProtoPath !== 'string' || !fs.existsSync(httpProtoPath)) {
    failures.push({
      fromFile: protoIndexJs,
      request: 'HTTP_PROTO_PATH',
      reason: `resolved HTTP_PROTO_PATH missing on disk: ${httpProtoPath ?? '(undefined)'}`,
    });
  }
}

for (const service of RUNTIME_SERVICES) {
  const mainJs = path.join(root, 'apps', service, 'dist', 'apps', service, 'src', 'main.js');
  if (!fs.existsSync(mainJs)) continue;

  const nodePath = collectNodePathDirs().join(path.delimiter);
  const previous = process.env.NODE_PATH;
  process.env.NODE_PATH = nodePath;
  Module._initPaths();
  const req = Module.createRequire(mainJs);
  try {
    const { HTTP_PROTO_PATH: httpProtoPath } = req('@plys/libraries/proto');
    if (typeof httpProtoPath !== 'string' || !fs.existsSync(httpProtoPath)) {
      failures.push({
        fromFile: mainJs,
        request: '@plys/libraries/proto HTTP_PROTO_PATH',
        reason: `resolved HTTP_PROTO_PATH missing on disk: ${httpProtoPath ?? '(undefined)'}`,
      });
    }
  } catch (error) {
    failures.push({
      fromFile: mainJs,
      request: '@plys/libraries/proto',
      reason: error instanceof Error ? error.message : String(error),
    });
  } finally {
    process.env.NODE_PATH = previous;
    Module._initPaths();
  }

  const bundledGrpcBootstrap = path.join(
    root,
    'apps',
    service,
    'dist',
    'packages',
    'common-nest',
    'grpc',
    'grpc-bootstrap.util.js',
  );
  if (fs.existsSync(bundledGrpcBootstrap)) {
    const bootstrapSource = fs.readFileSync(bundledGrpcBootstrap, 'utf8');
    if (/\bhttpProto\b/.test(bootstrapSource)) {
      failures.push({
        fromFile: bundledGrpcBootstrap,
        request: 'grpc-bootstrap protoPath',
        reason:
          'bundled grpc-bootstrap still lists http.proto separately — rebuild service after libraries grpc fix',
      });
    }
  }

  const bundledNotificationsClient = path.join(
    root,
    'apps',
    service,
    'dist',
    'packages',
    'common-nest',
    'modules',
    'notifications-client',
    'notifications-client.module.js',
  );
  if (fs.existsSync(bundledNotificationsClient)) {
    const clientSource = fs.readFileSync(bundledNotificationsClient, 'utf8');
    if (!/\bincludeDirs\b/.test(clientSource)) {
      failures.push({
        fromFile: bundledNotificationsClient,
        request: 'notifications-client loader.includeDirs',
        reason:
          'bundled notifications gRPC client missing loader.includeDirs — rebuild service after proto import fix',
      });
    }
    if (/resolveHttpProtoPath/.test(clientSource)) {
      failures.push({
        fromFile: bundledNotificationsClient,
        request: 'notifications-client protoPath',
        reason:
          'bundled notifications client still lists http.proto separately — use includeDirs for common/v1/http.proto imports',
      });
    }
  }
}

if (failures.length > 0) {
  console.error('Docker runtime module verification failed:\n');
  const unique = new Map();
  for (const failure of failures) {
    unique.set(`${failure.request}::${failure.reason}`, failure);
  }
  for (const failure of unique.values()) {
    console.error(`  - ${failure.request}`);
    console.error(`    reason: ${failure.reason}`);
    console.error(`    from: ${path.relative(root, failure.fromFile)}`);
  }
  process.exit(1);
}

console.log(
  `Docker runtime module verification passed (${scanRoots.length} scan roots, NODE_PATH dirs: ${collectNodePathDirs().length})`,
);
