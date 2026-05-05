import { AbstractRepository } from '@common/repositories';
import { IdempotencyKey } from '@database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IIdempotencyKeyRepository extends AbstractRepository<IdempotencyKey> {}
