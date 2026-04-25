export interface ILoginAttemptTracker {
  /**
   * Throws AUTH_ACCOUNT_LOCKED when the user has crossed the failure
   * threshold within the rolling window. Resolves silently otherwise.
   *
   * @param userId - UUID of the user attempting to authenticate.
   */
  assertNotLocked(userId: string): Promise<void>;

  /**
   * Increments the user's failure counter and (re)applies the window TTL on
   * first failure. Returns the post-increment count so callers can log.
   *
   * @param userId - UUID of the user that just failed authentication.
   * @returns The new failure count for the current window.
   */
  recordFailure(userId: string): Promise<number>;

  /**
   * Clears the user's failure counter — call after a successful login.
   *
   * @param userId - UUID of the user that just authenticated successfully.
   */
  reset(userId: string): Promise<void>;
}
