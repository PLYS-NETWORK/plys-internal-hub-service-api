import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { EnvironmentsService } from '@common/modules/environments';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private readonly envService: EnvironmentsService) {
    super({
      // The raw request body uses snake_case per API conventions.
      // Passport extracts the token BEFORE the ValidationPipe transforms it.
      jwtFromRequest: ExtractJwt.fromBodyField('refresh_token'),
      ignoreExpiration: false,
      secretOrKey: envService.jwtRefreshSecret,
    });
  }

  public validate(payload: JwtPayload): JwtPayload {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return payload;
  }
}
