import { ActivePlatform, SsoProvider } from '@database/enums';
import {
  AuthResponseDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
  UserResponseDto,
} from '@modules/auth/dto';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';

export interface ISessionContext {
  readonly ipAddress: string;
  readonly userAgent: string | null;
  readonly deviceId: string | null;
  readonly fingerprint: string | null;
}

export interface ISsoUserData {
  readonly providerUserId: string;
  readonly email: string;
  readonly displayName: string;
  readonly accessToken: string;
  readonly refreshToken: string | undefined;
}

// ─── Sub-service interfaces ───────────────────────────────────────────────────

export interface IBasicAuthService {
  /**
   * Registers a new user account and sends an email-verification link.
   *
   * Runs inside a transaction: user row, initial profile, and verification
   * token are created atomically. The method returns `void`; the caller must
   * instruct the client to check their inbox.
   *
   * @param dto     - Validated registration payload including role-specific fields.
   * @param context - Network metadata (IP, user-agent, device ID, fingerprint)
   *                  used to bind the eventual session.
   */
  register(dto: RegisterDto, context: ISessionContext): Promise<void>;

  /**
   * Consumes a one-time email-verification token and activates the account.
   *
   * On success the verification token is deleted and a new authenticated
   * session is created so the user is immediately logged in.
   *
   * @param token   - The opaque verification token from the email link.
   * @param context - Network metadata used to create the post-verification session.
   * @returns A fully populated `AuthResponseDto` with access and refresh tokens.
   * @throws TranslatableException (400) — token not found or already consumed.
   */
  verifyEmail(token: string, context: ISessionContext): Promise<AuthResponseDto>;

  /**
   * Re-sends the email-verification link to the address associated with the
   * provided email. Silently no-ops if the account is already verified so
   * that the response does not leak whether an email is registered.
   *
   * @param dto - Contains the `email` to resend verification to.
   */
  resendVerification(dto: ResendVerificationDto): Promise<void>;

  /**
   * Authenticates a user with email and password and issues a new session.
   *
   * Device-binding is enforced: if the incoming `deviceId` differs from the
   * one recorded on the active session the session is invalidated and the
   * user must re-authenticate on the new device.
   *
   * @param dto     - Login credentials (`email`, `password`, `active_platform`).
   * @param context - Network metadata used to bind the new session.
   * @returns A fully populated `AuthResponseDto` with access and refresh tokens.
   * @throws TranslatableException (401) — invalid credentials.
   * @throws TranslatableException (403) — account not verified or device mismatch.
   */
  login(dto: LoginDto, context: ISessionContext): Promise<AuthResponseDto>;

  /**
   * Changes the authenticated user's password after verifying the current one.
   *
   * All existing sessions for the user are invalidated after a successful
   * change to prevent stale token reuse.
   *
   * @param dto - Contains `current_password` and `new_password`.
   * @throws TranslatableException (401) — current password is incorrect.
   */
  changePassword(dto: ChangePasswordDto): Promise<void>;

  /**
   * Issues a single-use 6-digit OTP and emails it to the user. Always
   * resolves silently — even when no account matches — so callers cannot
   * enumerate registered emails.
   *
   * @param dto - Contains `email` and `active_platform`.
   */
  requestPasswordReset(dto: ForgotPasswordDto): Promise<void>;

  /**
   * Validates the OTP, replaces the password hash, and revokes every active
   * session for the user.
   *
   * @param dto - Contains `email`, `active_platform`, `otp`, `new_password`.
   * @throws TranslatableException (400) — OTP unknown, used, or expired.
   */
  resetPassword(dto: ResetPasswordDto): Promise<void>;
}

export interface ISessionService {
  /**
   * Returns the authenticated caller's own user profile.
   *
   * Identity is resolved from `RequestContextService`; no parameters are
   * accepted.
   *
   * @returns The caller's `UserResponseDto`.
   * @throws TranslatableException (404) — user record no longer exists.
   */
  me(): Promise<UserResponseDto>;

  /**
   * Issues a new access/refresh token pair using a valid refresh token.
   *
   * Single-use rotation: the lookup, `used_at` stamp, and new-session creation
   * happen inside a `pessimistic_write` lock so two concurrent callers cannot
   * both succeed with the same refresh token. If the supplied token matches a
   * session that is already used, this is treated as token reuse and **all**
   * sessions for the impacted user are revoked before throwing.
   *
   * @param refreshToken - The opaque refresh token from a previous session.
   * @param context      - Network metadata used to bind the renewed session.
   * @returns A new `AuthResponseDto` with rotated tokens.
   * @throws TranslatableException (401) — refresh token not found, already used, or expired.
   */
  refresh(refreshToken: string, context: ISessionContext): Promise<AuthResponseDto>;

  /**
   * Terminates the caller's current session by deleting the refresh token.
   *
   * Resolves silently even if the session is already gone, making it safe to
   * call on an already-expired token.
   */
  logout(): Promise<void>;

  /**
   * Creates a new session record and returns signed access and refresh tokens.
   *
   * Used internally after successful credential or SSO verification; not
   * exposed as a standalone HTTP endpoint.
   *
   * @param userId         - UUID of the authenticated user.
   * @param email          - The user's email address (embedded in the JWT payload).
   * @param activePlatform - Platform context (`BUSINESS` or `CONSULTANT`).
   * @param context        - Network metadata (IP, user-agent, device ID, fingerprint).
   * @returns Signed access and refresh tokens plus basic user info.
   */
  createSession(
    userId: string,
    email: string,
    activePlatform: ActivePlatform,
    context: ISessionContext,
  ): Promise<AuthResponseDto>;

  /**
   * Revokes every session belonging to the given user. Called by password
   * reset (force re-login on every device) and by refresh-token reuse
   * detection.
   *
   * @param userId - UUID of the user whose sessions to revoke.
   */
  revokeAllSessionsForUser(userId: string): Promise<void>;
}

export interface ISsoAuthService {
  /**
   * Authenticates or registers a user via a third-party SSO provider.
   *
   * If no account exists for the given `providerUserId` a new user and initial
   * profile are created inside a transaction. An authenticated session is then
   * created and tokens are returned.
   *
   * @param provider       - Lowercase provider name string (e.g. `"google"`).
   * @param userData       - Normalised user data returned by the provider verifier.
   * @param activePlatform - Platform context (`BUSINESS` or `CONSULTANT`).
   * @param context        - Network metadata used to bind the session.
   * @returns A fully populated `AuthResponseDto` with access and refresh tokens.
   * @throws TranslatableException (401) — provider token verification failed.
   */
  ssoLogin(
    provider: string,
    userData: ISsoUserData,
    activePlatform: ActivePlatform,
    context: ISessionContext,
  ): Promise<AuthResponseDto>;

  /**
   * Delegates ID-token verification to the registered `ISsoTokenProvider`
   * matching the given `providerName`.
   *
   * @param providerName - Enum discriminator for the SSO provider.
   * @param idToken      - The raw ID token (or access token) from the client.
   * @returns Normalised `ISsoUserData` extracted from the verified token.
   * @throws TranslatableException (401) — token invalid or provider not configured.
   */
  verifyProviderToken(providerName: SsoProvider, idToken: string): Promise<ISsoUserData>;
}

export interface IUserOnboardingService {
  /**
   * Creates the role-specific profile record for a newly registered user.
   *
   * Called inside the registration transaction so that user + profile are
   * inserted atomically. The profile type created depends on `active_platform`:
   * `BUSINESS` → `BusinessProfile`, `CONSULTANT` → `ConsultantProfile`.
   *
   * @param tx     - The active unit-of-work / transaction to enroll into.
   * @param userId - UUID of the newly created user.
   * @param dto    - Subset of the registration payload needed for profile init.
   * @returns The UUID of the created profile record.
   */
  createInitialProfile(
    tx: IUnitOfWork,
    userId: string,
    dto: Pick<RegisterDto, 'active_platform' | 'company_name' | 'full_name'>,
  ): Promise<string>;
}

// ─── Facade interface (AuthService) ──────────────────────────────────────────

/**
 * Facade contract that the `AuthController` depends on.
 *
 * `AuthService` implements this interface and delegates each method to the
 * appropriate domain sub-service (`BasicAuthService`, `SessionService`,
 * `SsoAuthService`). Keeping a single facade interface means the controller
 * is insulated from internal restructuring.
 */
export interface IAuthService {
  /**
   * Registers a new user account and sends an email-verification link.
   *
   * @param dto     - Validated registration payload.
   * @param context - Network metadata used to bind the eventual session.
   */
  register(dto: RegisterDto, context: ISessionContext): Promise<void>;

  /**
   * Consumes a one-time email-verification token and activates the account.
   *
   * @param token   - The opaque verification token from the email link.
   * @param context - Network metadata used to create the post-verification session.
   * @returns A fully populated `AuthResponseDto` with access and refresh tokens.
   * @throws TranslatableException (400) — token not found or already consumed.
   */
  verifyEmail(token: string, context: ISessionContext): Promise<AuthResponseDto>;

  /**
   * Re-sends the email-verification link to the given address.
   *
   * @param dto - Contains the `email` to resend verification to.
   */
  resendVerification(dto: ResendVerificationDto): Promise<void>;

  /**
   * Authenticates a user with email and password and issues a new session.
   *
   * @param dto     - Login credentials (`email`, `password`, `active_platform`).
   * @param context - Network metadata used to bind the new session.
   * @returns A fully populated `AuthResponseDto` with access and refresh tokens.
   * @throws TranslatableException (401) — invalid credentials.
   * @throws TranslatableException (403) — account not verified or device mismatch.
   */
  login(dto: LoginDto, context: ISessionContext): Promise<AuthResponseDto>;

  /**
   * Issues a new access/refresh token pair using a valid refresh token.
   *
   * @param refreshToken - The opaque refresh token from a previous session.
   * @param context      - Network metadata used to bind the renewed session.
   * @returns A new `AuthResponseDto` with rotated tokens.
   * @throws TranslatableException (401) — refresh token not found or expired.
   */
  refresh(refreshToken: string, context: ISessionContext): Promise<AuthResponseDto>;

  /**
   * Terminates the caller's current session by deleting the refresh token.
   */
  logout(): Promise<void>;

  /**
   * Returns the authenticated caller's own user profile.
   *
   * @returns The caller's `UserResponseDto`.
   * @throws TranslatableException (404) — user record no longer exists.
   */
  me(): Promise<UserResponseDto>;

  /**
   * Changes the authenticated user's password after verifying the current one.
   *
   * @param dto - Contains `current_password` and `new_password`.
   * @throws TranslatableException (401) — current password is incorrect.
   */
  changePassword(dto: ChangePasswordDto): Promise<void>;

  /**
   * Sends a one-time OTP to the user's email so they can recover access.
   * Always resolves silently to avoid disclosing account existence.
   *
   * @param dto - Contains `email` and `active_platform`.
   */
  requestPasswordReset(dto: ForgotPasswordDto): Promise<void>;

  /**
   * Validates the OTP, sets a new password, and revokes every session.
   *
   * @param dto - Contains `email`, `active_platform`, `otp`, `new_password`.
   * @throws TranslatableException (400) — OTP unknown, used, or expired.
   */
  resetPassword(dto: ResetPasswordDto): Promise<void>;

  /**
   * Authenticates or registers a user via a third-party SSO provider.
   *
   * @param provider       - Lowercase provider name string (e.g. `"google"`).
   * @param userData       - Normalised user data returned by the provider verifier.
   * @param activePlatform - Platform context (`BUSINESS` or `CONSULTANT`).
   * @param context        - Network metadata used to bind the session.
   * @returns A fully populated `AuthResponseDto` with access and refresh tokens.
   */
  ssoLogin(
    provider: string,
    userData: ISsoUserData,
    activePlatform: ActivePlatform,
    context: ISessionContext,
  ): Promise<AuthResponseDto>;

  /**
   * Verifies a Google ID token and returns normalised SSO user data.
   *
   * This is the public entry point used by the controller for the
   * Google-specific SSO flow before delegating to `ssoLogin`.
   *
   * @param idToken - The raw Google ID token from the client.
   * @returns Normalised `ISsoUserData` extracted from the verified token.
   * @throws TranslatableException (401) — ID token is invalid or expired.
   */
  verifyGoogleIdToken(idToken: string): Promise<ISsoUserData>;
}
