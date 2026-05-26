import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { IdempotencyKey } from '@plys/libraries/database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IIdempotencyKeyRepository extends AbstractRepository<IdempotencyKey> {}
