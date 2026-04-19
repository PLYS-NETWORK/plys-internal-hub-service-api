import { AbstractRepository } from '@common/repositories';
import { AuthToken } from '@database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IAuthTokenRepository extends AbstractRepository<AuthToken> {}
