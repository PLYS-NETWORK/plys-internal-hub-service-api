import { AbstractRepository } from '@common/repositories';
import { UserSession } from '@database/entities';

export interface IUserSessionRepository extends AbstractRepository<UserSession> {
  /**
   * Looks up an active (`used_at IS NULL`) session by its hashed token and
   * acquires a row-level write lock. Must be called inside an active
   * transaction; the lock is released at commit/rollback.
   *
   * @param tokenHash - SHA-256 hex digest of the raw refresh token.
   * @returns The locked UserSession, or null if no active row matches.
   */
  findActiveByTokenForUpdate(tokenHash: string): Promise<UserSession | null>;

  /**
   * Looks up a session by hashed token regardless of `used_at`. Used to
   * detect token reuse: a row found here that is also flagged as used means
   * the same refresh token was presented twice.
   *
   * @param tokenHash - SHA-256 hex digest of the raw refresh token.
   * @returns The matching UserSession, or null if none exists.
   */
  findByToken(tokenHash: string): Promise<UserSession | null>;
}
