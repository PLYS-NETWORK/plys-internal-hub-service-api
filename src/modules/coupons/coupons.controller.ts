import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CouponsService } from './coupons.service';

@ApiTags('Coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}
}
