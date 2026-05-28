import { Module } from '@nestjs/common';
import { FileContentValidator } from '@plys/libraries/common-nest/modules/file-storage';

import { PlatformClientsModule } from '@/clients/v1/platform';

import { gatewayJwtAuthImports } from '../shared/gateway-http-auth.providers';
import { HealthController } from './controllers/health.controller';
import { SkillsController } from './controllers/skills.controller';
import { PlatformFilesController } from './files.controller';
import { PLATFORM_HTTP_PROVIDERS } from './platform-http.providers';

@Module({
  imports: [PlatformClientsModule, ...gatewayJwtAuthImports],
  controllers: [PlatformFilesController, SkillsController, HealthController],
  providers: [...PLATFORM_HTTP_PROVIDERS, FileContentValidator],
})
export class PlatformHttpModule {}
