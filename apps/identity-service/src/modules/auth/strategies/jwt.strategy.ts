import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { JwtPayload } from '@plys/libraries/common-nest/interfaces/jwt-payload.interface';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { FastifyRequest } from 'fastify';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly strict: boolean;
  private readonly expectedIssuer: string;
  private readonly expectedAudience: string;

  constructor(private readonly envService: EnvironmentsService) {
    const strict = envService.jwtStrictClaims;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: envService.jwtAccessSecret,
      passReqToCallback: true,
      // Algorithm pinning + issuer/audience binding. In non-strict mode we
      // omit issuer/audience here and validate them softly in `validate()`
      // so tokens missing the claims are still accepted during roll-forward.
      algorithms: ['HS256'],
      ...(strict ? { issuer: envService.jwtIssuer, audience: envService.jwtAudience } : {}),
    });
    this.strict = strict;
    this.expectedIssuer = envService.jwtIssuer;
    this.expectedAudience = envService.jwtAudience;
  }

  public validate(request: FastifyRequest, payload: JwtPayload): JwtPayload {
    // Soft iss/aud check: when present they must match. Once strict mode is
    // on, passport-jwt enforces both claims natively before reaching here.
    if (!this.strict) {
      if (payload.iss !== undefined && payload.iss !== this.expectedIssuer) {
        throw new UnauthorizedException('Token issuer mismatch');
      }
      if (payload.aud !== undefined && payload.aud !== this.expectedAudience) {
        throw new UnauthorizedException('Token audience mismatch');
      }
    }

    // Device-binding: if the JWT contains a deviceId, the request must come from the same device.
    // Prevents session hijacking on BUSINESS/ADMIN accounts.
    if (payload.deviceId) {
      const requestDeviceId = (request.headers as Record<string, string>)['x-device-id'];
      if (requestDeviceId !== payload.deviceId) {
        throw new UnauthorizedException('Device mismatch — re-authentication required');
      }
    }

    return payload;
  }
}
