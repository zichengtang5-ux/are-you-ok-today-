import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private reflector: Reflector,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', 'dev-secret'),
    });
  }

  async validate(payload: { sub: string; type: string }) {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('无效的令牌类型');
    }
    return { id: payload.sub };
  }
}
