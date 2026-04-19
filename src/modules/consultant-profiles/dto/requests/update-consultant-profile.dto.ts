import { PartialType } from '@nestjs/swagger';

import { IUpdateConsultantProfileRequest } from './interfaces/update-consultant-profile.request.interface';
import { OnboardConsultantProfileDto } from './onboard-consultant-profile.dto';

export class UpdateConsultantProfileDto
  extends PartialType(OnboardConsultantProfileDto)
  implements IUpdateConsultantProfileRequest {}
