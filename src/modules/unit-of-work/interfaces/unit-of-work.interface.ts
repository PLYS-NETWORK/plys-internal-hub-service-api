// IUnitOfWork will be populated once entities are defined.
// Provides repository accessors and transaction management.
export interface IUnitOfWork {
  withTransaction<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T>;
}
