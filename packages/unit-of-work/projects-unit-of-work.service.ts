import { Injectable } from '@nestjs/common';

import { IUnitOfWork } from './interfaces/unit-of-work.interface';
import { UnitOfWorkService } from './unit-of-work.service';

@Injectable()
export class ProjectsUnitOfWorkService extends UnitOfWorkService {
  public override async withTransaction<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    return super.withTransaction(work);
  }
}
