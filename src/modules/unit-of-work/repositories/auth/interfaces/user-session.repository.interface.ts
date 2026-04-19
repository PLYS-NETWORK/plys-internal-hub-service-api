import { AbstractRepository } from '@common/repositories';
import { UserSession } from '@database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IUserSessionRepository extends AbstractRepository<UserSession> {}
