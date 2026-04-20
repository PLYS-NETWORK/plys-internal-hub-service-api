import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { EnvironmentsService } from '@common/modules/environments';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { FastifyRequest } from 'fastify';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly envService: EnvironmentsService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: envService.jwtAccessSecret,
      passReqToCallback: true,
    });
  }

  public validate(request: FastifyRequest, payload: JwtPayload): JwtPayload {
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
