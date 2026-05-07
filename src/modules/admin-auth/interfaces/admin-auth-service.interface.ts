import { AuthResponseDto } from '@modules/auth/dto/responses/auth-response.dto';
import { ISessionContext } from '@modules/auth/interfaces/auth-service.interface';

import { AdminRequestOtpDto } from '../dto/requests/admin-request-otp.dto';
import { AdminVerifyOtpDto } from '../dto/requests/admin-verify-otp.dto';

export interface IAdminAuthService {
  /**
   * Validates the email against the admin whitelist and dispatches a 6-digit OTP.
   *
   * Always resolves with void regardless of whether the email is whitelisted —
   * callers cannot distinguish missing vs. valid email (prevents enumeration).
   *
   * @param dto           - Contains `email` and `active_platform` (must be ADMIN_PLATFORM).
   * @param sessionContext - IP, user-agent, device ID, and fingerprint from the request.
   * @throws TranslatableException (ADMIN_AUTH_RESEND_LIMIT) if the per-window or daily
   *   resend rate limit is exceeded.
   */
  requestOtp(dto: AdminRequestOtpDto, sessionContext: ISessionContext): Promise<void>;

  /**
   * Validates the submitted OTP and issues an authenticated admin session.
   *
   * @param dto           - Contains `email`, `otp`, and `active_platform`.
   * @param sessionContext - IP, user-agent, device ID, and fingerprint from the request.
   * @returns AuthResponseDto with `access_token`, `refresh_token`, `expires_in`, and `user`.
   * @throws TranslatableException (GENERIC_BAD_REQUEST) if `deviceId` or `fingerprint` is absent.
   * @throws TranslatableException (ADMIN_AUTH_OTP_LOCKED) if the email is locked after
   *   5 consecutive wrong-OTP attempts.
   * @throws TranslatableException (ADMIN_AUTH_OTP_INVALID) if the OTP is wrong, expired, or
   *   already used.
   * @throws TranslatableException (GENERIC_FORBIDDEN) if the admin account is inactive.
   */
  verifyOtp(dto: AdminVerifyOtpDto, sessionContext: ISessionContext): Promise<AuthResponseDto>;
}
