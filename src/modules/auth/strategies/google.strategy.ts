import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

import { EnvironmentsService } from '../../../common/modules/environments';

export interface GoogleProfile {
  readonly providerUserId: string;
  readonly email: string;
  readonly displayName: string;
  readonly accessToken: string;
  readonly refreshToken: string | undefined;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly envService: EnvironmentsService) {
    super({
      clientID: envService.googleClientId,
      clientSecret: envService.googleClientSecret,
      callbackURL: envService.googleCallbackUrl,
      scope: ['email', 'profile'],
    });
  }

  // Passport calls this after Google returns the auth code exchange result.
  // We normalise the profile into a flat object that AuthService.ssoLogin() expects.
  public validate(
    accessToken: string,
    refreshToken: string | undefined,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const googleProfile: GoogleProfile = {
      providerUserId: profile.id,
      email: profile.emails?.[0]?.value ?? '',
      displayName: profile.displayName ?? '',
      accessToken,
      refreshToken,
    };

    done(null, googleProfile);
  }
}
