import { Injectable } from '@nestjs/common';

import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';

@Injectable()
export class UsersService {
  constructor(private readonly uow: UnitOfWorkService) {}
}
