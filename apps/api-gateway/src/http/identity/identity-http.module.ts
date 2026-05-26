import { Module } from '@nestjs/common';

import { IdentityClientsModule } from '@/clients/identity';

import { AdminAllowedEmailsController } from './admin-allowed-emails.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AuthController } from './auth.controller';
import { IdentityAuthSupportModule } from './identity-auth-support.module';

@Module({
  imports: [IdentityClientsModule, IdentityAuthSupportModule],
  controllers: [AuthController, AdminAuthController, AdminAllowedEmailsController],
})
export class IdentityHttpModule {}
