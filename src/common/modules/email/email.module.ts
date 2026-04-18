import { Global, Module } from '@nestjs/common';

import { EMAIL_PROVIDER_TOKEN } from './constants';
import { EmailService } from './email.service';
import { ResendEmailProvider } from './providers';

/**
 * EmailModule wires the Strategy Pattern for email delivery.
 *
 * Current provider: ResendEmailProvider (resend SDK).
 *
 * To swap providers:
 *   1. Create a class implementing IEmailProvider (e.g. SmtpEmailProvider)
 *   2. Replace `useClass: ResendEmailProvider` below — nothing else changes.
 *
 * @Global() makes EmailService available throughout the application without
 * re-importing this module in every feature module.
 */
@Global()
@Module({
  providers: [
    {
      provide: EMAIL_PROVIDER_TOKEN,
      useClass: ResendEmailProvider,
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
