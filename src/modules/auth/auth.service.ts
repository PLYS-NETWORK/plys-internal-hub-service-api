import { Injectable } from '@nestjs/common';

import { UnitOfWorkService } from '../unit-of-work/unit-of-work.service';

@Injectable()
export class AuthService {
  constructor(private readonly uow: UnitOfWorkService) {}
}
