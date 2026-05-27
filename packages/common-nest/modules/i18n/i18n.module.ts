import { Global, Module } from '@nestjs/common';
import { DEFAULT_LOCALE } from '@plys/libraries/common-nest/modules/request-context/interfaces/request-context.interface';
import * as fs from 'fs';
import { AcceptLanguageResolver, HeaderResolver, I18nModule as NestI18nModule } from 'nestjs-i18n';
import * as path from 'path';

function isValidI18nRoot(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'en'));
}

function collectMonorepoI18nCandidates(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const roots = [process.cwd(), __dirname];
  for (const start of roots) {
    let dir = start;
    for (let depth = 0; depth < 8; depth += 1) {
      for (const suffix of ['packages/dist/i18n', 'packages/common-nest/i18n']) {
        const candidate = path.join(dir, suffix);
        if (!seen.has(candidate)) {
          seen.add(candidate);
          out.push(candidate);
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return out;
}

function resolveI18nTranslationsPath(): string {
  const candidates = [
    // libraries build: packages/dist/common-nest/modules/i18n → packages/dist/i18n
    path.resolve(__dirname, '..', '..', '..', 'i18n'),
    // app nest build: …/dist/packages/common-nest/modules/i18n → …/dist/i18n
    path.resolve(__dirname, '..', '..', '..', '..', 'i18n'),
    // legacy nest asset layout that nested an extra i18n/ segment
    path.resolve(__dirname, '..', '..', '..', '..', 'i18n', 'i18n'),
    ...collectMonorepoI18nCandidates(),
  ];
  for (const candidate of candidates) {
    if (isValidI18nRoot(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}

// Wraps nestjs-i18n with our conventions:
//   - Default locale 'en'
//   - Resolution order: custom `lang` header → Accept-Language → fallback 'en'
//   - Translation files live at src/i18n/{en,tr}/*.json (one file per domain)
// Unsupported locales fall back silently. See also RequestContextMiddleware
// which independently resolves the same locale and stores it on the request context.
@Global()
@Module({
  imports: [
    NestI18nModule.forRoot({
      fallbackLanguage: DEFAULT_LOCALE,
      loaderOptions: {
        path: resolveI18nTranslationsPath(),
        watch: process.env.NODE_ENV !== 'production',
      },
      resolvers: [new HeaderResolver(['lang']), AcceptLanguageResolver],
      typesOutputPath: undefined,
    }),
  ],
  exports: [NestI18nModule],
})
export class I18nModule {}
