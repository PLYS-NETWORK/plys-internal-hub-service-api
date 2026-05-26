import { execSync } from 'node:child_process';
import fs from 'node:fs';

const grpcFiles = execSync('find apps -name "*.grpc-controller.ts"', { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

for (const file of grpcFiles) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  if (!content.includes('IHttpResponse')) {
    content = content.replace(
      /import \{([^}]+)\} from '@plys\/libraries\/common-nest\/grpc';/,
      (match, imports) => {
        if (imports.includes('IHttpResponse')) return match;
        return `import {${imports.trim()}, IHttpResponse } from '@plys/libraries/common-nest/grpc';`;
      },
    );
  }

  content = content.replace(
    /public handle(Dispatch|Http)\(([^)]*)\)\s*\{/g,
    'public handle$1($2): Promise<IHttpResponse> {',
  );

  content = content.replace(/private async (\w+)\(([^)]*)\)\s*\{/g, (full, name, params) => {
    if (name === 'buildSessionContext') return full;
    return `private async ${name}(${params}): Promise<IHttpResponse> {`;
  });

  content = content.replace(/async \(request\) => \{/g, 'async (request): Promise<IHttpResponse> => {');

  if (content !== original) fs.writeFileSync(file, content);
}

console.log(`Patched ${grpcFiles.length} grpc controller files`);
