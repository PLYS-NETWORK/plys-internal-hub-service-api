import { HttpStatus, Injectable } from '@nestjs/common';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { SsoProvider } from '@plys/libraries/database/enums';
import { OAuth2Client, TokenPayload } from 'google-auth-library';

import { ERROR_CODES } from '../../../errors/error-codes';
import { ISsoUserData } from '../interfaces/auth-service.interface';
import { ISsoTokenProvider } from './interfaces/sso-provider.interface';

const ALLOWED_ISSUERS = new Set<string>(['https://accounts.google.com', 'accounts.google.com']);

@Injectable()
export class GoogleSsoProvider implements ISsoTokenProvider {
  public readonly providerName = SsoProvider.GOOGLE;

  private readonly logger: AppLogger;
  private readonly client: OAuth2Client;

  constructor(
    private readonly envService: EnvironmentsService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(GoogleSsoProvider.name, requestContext);
    // Constructor is only called when isGoogleOAuthConfigured is true
    // (enforced by the AuthModule factory).
    this.client = new OAuth2Client(envService.googleClientId);
  }

  /** @inheritdoc */
  public async verifyToken(idToken: string): Promise<ISsoUserData> {
    this.logger.log(`verifyToken — start | provider: google`);

    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.envService.googleClientId,
      });
      payload = ticket.getPayload();
    } catch (err) {
      this.logger.warn(
        `verifyToken — library rejected token | error: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new TranslatableException({
        messageKey: 'error.auth.token_invalid',
        errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    if (!payload) {
      this.logger.warn(`verifyToken — empty payload from Google`);
      throw new TranslatableException({
        messageKey: 'error.auth.token_invalid',
        errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    // Defence in depth — google-auth-library should reject these already, but
    // we re-assert so a library bug or non-Google IdP cannot slip through.
    if (!payload.iss || !ALLOWED_ISSUERS.has(payload.iss)) {
      this.logger.warn(`verifyToken — issuer not Google | iss: ${payload.iss ?? 'null'}`);
      throw new TranslatableException({
        messageKey: 'error.auth.token_invalid',
        errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
        status: HttpStatus.UNAUTHORIZED,
      });
    }
    if (payload.email_verified !== true) {
      this.logger.warn(`verifyToken — email not verified | sub: ${payload.sub ?? 'null'}`);
      throw new TranslatableException({
        messageKey: 'error.auth.token_invalid',
        errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
        status: HttpStatus.UNAUTHORIZED,
      });
    }
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
      this.logger.warn(`verifyToken — token expired | sub: ${payload.sub ?? 'null'}`);
      throw new TranslatableException({
        messageKey: 'error.auth.token_expired',
        errorCode: ERROR_CODES.AUTH_TOKEN_EXPIRED,
        status: HttpStatus.UNAUTHORIZED,
      });
    }
    if (!payload.email) {
      this.logger.warn(`verifyToken — missing email claim | sub: ${payload.sub ?? 'null'}`);
      throw new TranslatableException({
        messageKey: 'error.auth.sso_email_missing',
        errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    this.logger.log(`verifyToken — complete | sub: ${payload.sub}`);
    return {
      providerUserId: payload.sub,
      email: payload.email,
      displayName: payload.name ?? '',
      accessToken: '',
      refreshToken: undefined,
    };
  }
}
