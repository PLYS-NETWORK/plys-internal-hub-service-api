import { AbstractRepository } from '@common/repositories';
import { FileEntity } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, IsNull, LessThan } from 'typeorm';

import { IFileRepository } from './interfaces';

@Injectable()
export class FileRepository extends AbstractRepository<FileEntity> implements IFileRepository {
  constructor(@InjectEntityManager() manager: EntityManager) {
    super(FileEntity, manager);
  }

  /** @inheritdoc */
  public withManager(manager: EntityManager): this {
    return new FileRepository(manager) as this;
  }

  /** @inheritdoc */
  public async sumActiveBytesByOwner(ownerUserId: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('file')
      .select('COALESCE(SUM(file.size_bytes), 0)', 'total')
      .where('file.owner_user_id = :ownerUserId', { ownerUserId })
      .andWhere('file.deleted_at IS NULL')
      .getRawOne<{ total: string }>();
    // SUM(bigint) returns string in pg driver; coerce to number.
    return result ? Number(result.total) : 0;
  }

  /** @inheritdoc */
  public async countActiveByOwner(ownerUserId: string): Promise<number> {
    return this.repository.count({
      where: { ownerUserId, deletedAt: IsNull() },
    });
  }

  /** @inheritdoc */
  public async findExpiredSoftDeletes(cutoff: Date, limit: number): Promise<FileEntity[]> {
    // `LessThan(cutoff)` already excludes NULL rows in SQL semantics, so
    // there's no need for an explicit `Not(IsNull())` — combining with
    // `withDeleted: true` brings the soft-deleted rows into scope.
    return this.repository.find({
      withDeleted: true,
      where: { deletedAt: LessThan(cutoff) },
      take: limit,
      order: { deletedAt: 'ASC' },
    });
  }

  /** @inheritdoc */
  public async hardDelete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
