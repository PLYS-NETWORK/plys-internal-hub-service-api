/**
 * Base contract for per-service Unit of Work implementations.
 * Each microservice extends this with its owned repository set.
 */
export abstract class AbstractUnitOfWork<TRepos> {
  public abstract withTransaction<R>(work: (tx: TRepos) => Promise<R>): Promise<R>;
}
