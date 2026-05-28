import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { CompositeTransactionFlow } from '@plys/libraries/database/composite-transactions';
import { DataSource, EntityManager } from 'typeorm';

import { CompositeFlowOwnerService } from './composite-flow.registry';

export type SharedDbWork<T> = (manager: EntityManager) => Promise<T>;

/**
 * Runs composite flows in a single PostgreSQL transaction (shared DB phase).
 * Participating ports receive the same EntityManager via withManager().
 */
@Injectable()
export class SharedDbTransactionCoordinator {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  public async run<R>(
    _flow: CompositeTransactionFlow,
    _owner: CompositeFlowOwnerService,
    work: SharedDbWork<R>,
  ): Promise<R> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const result = await work(queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
