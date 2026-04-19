import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EnvironmentsService } from '@common/modules/environments';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { SsoProvider } from '@database/enums/sso-provider.enum';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

import { ISsoUserData } from '../interfaces/auth-service.interface';
import { ISsoTokenProvider } from './interfaces/sso-provider.interface';

@Injectable()
export class GoogleSsoProvider implements ISsoTokenProvider {
  public readonly providerName = SsoProvider.GOOGLE;

  private readonly logger = new Logger(GoogleSsoProvider.name);
  private readonly client: OAuth2Client;

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly envService: EnvironmentsService,
    private readonly requestContext: RequestContextService,
  ) {
    // Constructor is only called when isGoogleOAuthConfigured is true
    // (enforced by the AuthModule factory).
    this.client = new OAuth2Client(envService.googleClientId);
  }

  public async verifyToken(idToken: string): Promise<ISsoUserData> {
    this.logger.log(`[${this.rid}] verifyToken — start | provider: google`);

    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: this.envService.googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      this.logger.warn(`[${this.rid}] verifyToken — empty payload from Google`);
      throw new TranslatableException({
        messageKey: 'error.auth.token_invalid',
        errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    this.logger.log(`[${this.rid}] verifyToken — complete | sub: ${payload.sub}`);
    return {
      providerUserId: payload.sub,
      email: payload.email ?? '',
      displayName: payload.name ?? '',
      accessToken: '',
      refreshToken: undefined,
    };
  }
}
