import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

import { IUnitOfWork } from './interfaces/unit-of-work.interface';

@Injectable()
export class UnitOfWorkService implements IUnitOfWork {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  public async withTransaction<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const txUow = this.buildTransactionalUow(queryRunner.manager);
      const result = await work(txUow);
      await queryRunner.commitTransaction();
      return result;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // Returns a lightweight UoW scoped to a single EntityManager (shared transaction).
  // Repository accessors will be added here as entities are defined.
  private buildTransactionalUow(_manager: EntityManager): IUnitOfWork {
    return new TransactionalUnitOfWork(_manager);
  }
}

class TransactionalUnitOfWork implements IUnitOfWork {
  constructor(private readonly _manager: EntityManager) {}

  public get manager(): EntityManager {
    return this._manager;
  }

  public async withTransaction<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    // Already inside a transaction — execute work directly on the same manager.
    return work(this);
  }
}
