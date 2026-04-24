import { ActivePlatform } from '@database/enums';
import { SetMetadata } from '@nestjs/common';

export const PLATFORM_KEY = 'platform';

export const Platform = (...platforms: ActivePlatform[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(PLATFORM_KEY, platforms);
