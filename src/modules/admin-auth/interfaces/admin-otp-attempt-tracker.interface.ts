export interface IAdminOtpAttemptTracker {
  /**
   * Throws ADMIN_AUTH_OTP_LOCKED when the email has crossed the failure
   * threshold within the rolling window. Resolves silently otherwise.
   *
   * @param email - Admin email address being verified.
   */
  assertNotLocked(email: string): Promise<void>;

  /**
   * Increments the failure counter for the given email. Sets a 1-hour TTL on
   * the first failure so the counter rolls after the window expires.
   *
   * @param email - Admin email address that just submitted a wrong OTP.
   * @returns The new failure count for the current window.
   */
  recordFailure(email: string): Promise<number>;

  /**
   * Clears the failure counter — call after a successful OTP verification.
   *
   * @param email - Admin email address that just authenticated successfully.
   */
  reset(email: string): Promise<void>;
}
