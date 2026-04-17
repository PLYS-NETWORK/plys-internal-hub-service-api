import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { WalletsService } from './wallets.service';

@ApiTags('Wallets')
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}
}
