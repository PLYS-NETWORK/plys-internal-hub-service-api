import {
  DeepPartial,
  DeleteResult,
  EntityManager,
  EntityTarget,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  InsertResult,
  ObjectLiteral,
  QueryDeepPartialEntity,
  RemoveOptions,
  Repository,
  SaveOptions,
  SelectQueryBuilder,
  UpdateResult,
} from 'typeorm';

/**
 * Base class for all domain repositories.
 *
 * Wraps the TypeORM `Repository<T>` and provides:
 *  - `findByActiveId`: lookup by PK, excludes soft-deleted rows (normal default)
 *  - `findById`: lookup by PK, includes soft-deleted rows (for restore / audit)
 *  - `withManager`: factory method that returns a new instance bound to a given
 *    EntityManager — used by UnitOfWorkService to produce transactional clones
 *    where every read/write joins the same QueryRunner.
 *
 * Design: All proxy methods forward directly to the underlying TypeORM
 * Repository so service code never depends on TypeORM internals directly.
 */
export abstract class AbstractRepository<T extends ObjectLiteral> {
  protected readonly repository: Repository<T>;

  constructor(entity: EntityTarget<T>, manager: EntityManager) {
    this.repository = manager.getRepository(entity);
  }

  /**
   * Returns a new repository instance bound to the given EntityManager.
   * Every concrete subclass must implement this as:
   *   `return new ConcreteRepository(manager) as this;`
   *
   * Called by UnitOfWorkService.withTransaction to produce a transactional
   * clone so all operations inside the callback share a single QueryRunner.
   */
  public abstract withManager(manager: EntityManager): this;

  // ─── Default lookup helpers ────────────────────────────────────────────────

  /**
   * Finds a record by primary key, excluding soft-deleted rows (deleted_at IS NULL).
   * Use this for all normal active-record lookups.
   */
  public async findByActiveId(id: string): Promise<T | null> {
    return this.repository.findOne({ where: { id } as unknown as FindOptionsWhere<T> });
  }

  /**
   * Finds a record by primary key, including soft-deleted rows.
   * Use this when you need to inspect or restore a previously deleted record.
   */
  public async findById(id: string): Promise<T | null> {
    return this.repository.findOne({
      where: { id } as unknown as FindOptionsWhere<T>,
      withDeleted: true,
    });
  }

  /** Batch lookup by primary keys — avoids N+1 `findById` loops in list hydration. */
  public async findByIds(ids: readonly string[]): Promise<T[]> {
    if (ids.length === 0) {
      return [];
    }
    const uniqueIds = [...new Set(ids)];
    return this.repository
      .createQueryBuilder('entity')
      .where('entity.id IN (:...ids)', { ids: uniqueIds })
      .withDeleted()
      .getMany();
  }

  // ─── TypeORM Repository proxies ───────────────────────────────────────────

  public find(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repository.find(options);
  }

  public findOne(options: FindOneOptions<T>): Promise<T | null> {
    return this.repository.findOne(options);
  }

  public findOneOrFail(options: FindOneOptions<T>): Promise<T> {
    return this.repository.findOneOrFail(options);
  }

  public findBy(where: FindOptionsWhere<T> | FindOptionsWhere<T>[]): Promise<T[]> {
    return this.repository.findBy(where);
  }

  public findOneBy(where: FindOptionsWhere<T> | FindOptionsWhere<T>[]): Promise<T | null> {
    return this.repository.findOneBy(where);
  }

  public findAndCount(options?: FindManyOptions<T>): Promise<[T[], number]> {
    return this.repository.findAndCount(options);
  }

  public count(options?: FindManyOptions<T>): Promise<number> {
    return this.repository.count(options);
  }

  public exists(options?: FindManyOptions<T>): Promise<boolean> {
    return this.repository.exists(options);
  }

  public create(): T;
  public create(entityLike: DeepPartial<T>): T;
  public create(entityLike: DeepPartial<T>[]): T[];
  public create(entityLike?: DeepPartial<T> | DeepPartial<T>[]): T | T[] {
    if (Array.isArray(entityLike)) {
      return this.repository.create(entityLike);
    }
    if (entityLike === undefined) {
      return this.repository.create();
    }
    return this.repository.create(entityLike);
  }

  public save(entity: DeepPartial<T>, options?: SaveOptions): Promise<T>;
  public save(entities: DeepPartial<T>[], options?: SaveOptions): Promise<T[]>;
  public save(
    entityOrEntities: DeepPartial<T> | DeepPartial<T>[],
    options?: SaveOptions,
  ): Promise<T | T[]> {
    if (Array.isArray(entityOrEntities)) {
      return this.repository.save(entityOrEntities, options);
    }
    return this.repository.save(entityOrEntities, options);
  }

  /**
   * Single multi-row INSERT. Use for append-only tables (e.g. chat_message)
   * where rows are always new — `save([…])` would issue one statement per
   * row because it has to disambiguate UPDATE vs INSERT per element.
   */
  public insert(
    entity: QueryDeepPartialEntity<T> | QueryDeepPartialEntity<T>[],
  ): Promise<InsertResult> {
    return this.repository.insert(entity);
  }

  public update(
    criteria: string | string[] | FindOptionsWhere<T>,
    partialEntity: QueryDeepPartialEntity<T>,
  ): Promise<UpdateResult> {
    return this.repository.update(criteria, partialEntity);
  }

  public delete(criteria: string | string[] | FindOptionsWhere<T>): Promise<DeleteResult> {
    return this.repository.delete(criteria);
  }

  public softDelete(criteria: string | string[] | FindOptionsWhere<T>): Promise<UpdateResult> {
    return this.repository.softDelete(criteria);
  }

  public restore(criteria: string | string[] | FindOptionsWhere<T>): Promise<UpdateResult> {
    return this.repository.restore(criteria);
  }

  public remove(entity: T, options?: RemoveOptions): Promise<T>;
  public remove(entities: T[], options?: RemoveOptions): Promise<T[]>;
  public remove(entityOrEntities: T | T[], options?: RemoveOptions): Promise<T | T[]> {
    if (Array.isArray(entityOrEntities)) {
      return this.repository.remove(entityOrEntities, options);
    }
    return this.repository.remove(entityOrEntities, options);
  }

  public createQueryBuilder(alias?: string): SelectQueryBuilder<T> {
    return this.repository.createQueryBuilder(alias);
  }

  /**
   * Runs raw SQL on the EntityManager bound to this repository — preserves
   * transaction context when the repository was cloned via `withManager`.
   * Use sparingly; prefer `createQueryBuilder` when the operation can be
   * expressed via TypeORM. The escape hatch exists for SQL features TypeORM
   * does not model (e.g. `UPDATE ... FROM (VALUES ...)`).
   */
  public query<TResult = unknown>(sql: string, parameters?: unknown[]): Promise<TResult> {
    return this.repository.manager.query(sql, parameters);
  }
}
