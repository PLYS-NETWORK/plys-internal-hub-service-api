import { Global, Module } from '@nestjs/common';

import { COPYLEAKS_PROVIDER_TOKEN } from './constants';
import { CopyleaksService } from './copyleaks.service';
import { CopyleaksApiProvider } from './providers/copyleaks-api.provider';

/**
 * CopyleaksModule wires the Strategy Pattern for AI content detection.
 *
 * Current provider: CopyleaksApiProvider (Copyleaks AI Detection API).
 *
 * To swap providers:
 *   1. Create a class implementing ICopyleaksProvider (e.g. GptZeroProvider)
 *   2. Replace `useClass: CopyleaksApiProvider` below — nothing else changes.
 *
 * @Global() makes CopyleaksService available throughout the application.
 */
@Global()
@Module({
  providers: [
    {
      provide: COPYLEAKS_PROVIDER_TOKEN,
      useClass: CopyleaksApiProvider,
    },
    CopyleaksService,
  ],
  exports: [CopyleaksService],
})
export class CopyleaksModule {}
