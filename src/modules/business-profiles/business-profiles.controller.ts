import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { BusinessProfilesService } from './business-profiles.service';

@ApiTags('Business Profiles')
@Controller('business-profiles')
export class BusinessProfilesController {
  constructor(private readonly businessProfilesService: BusinessProfilesService) {}
}
