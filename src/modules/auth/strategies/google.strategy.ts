import { EnvironmentsService } from '@common/modules/environments';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

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
    // Only instantiated when all three Google env vars are present (enforced
    // by the AuthModule factory). No need to guard against empty strings here.
    super({
      clientID: envService.googleClientId!,
      clientSecret: envService.googleClientSecret!,
      callbackURL: envService.googleCallbackUrl!,
      scope: ['email', 'profile'],
    });
  }

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
