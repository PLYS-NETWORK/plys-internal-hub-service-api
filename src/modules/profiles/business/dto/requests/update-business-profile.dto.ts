import { PartialType } from '@nestjs/swagger';

import { IUpdateBusinessProfileRequest } from './interfaces/update-business-profile.request.interface';
import { OnboardBusinessProfileDto } from './onboard-business-profile.dto';

export class UpdateBusinessProfileDto
  extends PartialType(OnboardBusinessProfileDto)
  implements IUpdateBusinessProfileRequest {}
