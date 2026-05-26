import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { AuthToken } from '@plys/libraries/database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IAuthTokenRepository extends AbstractRepository<AuthToken> {}
