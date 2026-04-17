import { Injectable } from '@nestjs/common';

import { UnitOfWorkService } from '../unit-of-work/unit-of-work.service';

@Injectable()
export class ProductsService {
  constructor(private readonly uow: UnitOfWorkService) {}
}
