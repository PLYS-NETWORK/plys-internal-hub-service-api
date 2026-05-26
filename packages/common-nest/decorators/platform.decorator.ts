import { SetMetadata } from '@nestjs/common';
import { ActivePlatform } from '@plys/libraries/database/enums';

export const PLATFORM_KEY = 'platform';

export const Platform = (...platforms: ActivePlatform[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(PLATFORM_KEY, platforms);
