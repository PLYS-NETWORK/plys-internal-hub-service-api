import { DEFAULT_LOCALE } from '@common/modules/request-context/interfaces/request-context.interface';
import { Global, Module } from '@nestjs/common';
import { AcceptLanguageResolver, HeaderResolver, I18nModule as NestI18nModule } from 'nestjs-i18n';
import * as path from 'path';

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
        path: path.resolve(__dirname, '..', '..', '..', 'i18n'),
        watch: process.env.NODE_ENV !== 'production',
      },
      resolvers: [new HeaderResolver(['lang']), AcceptLanguageResolver],
      typesOutputPath: undefined,
    }),
  ],
  exports: [NestI18nModule],
})
export class I18nModule {}
