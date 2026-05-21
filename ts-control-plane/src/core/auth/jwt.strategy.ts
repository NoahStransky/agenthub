import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'change-me',
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      tenantId: payload.activeTenantId,
      email: payload.email,
      platformRole: payload.platformRole,
      memberRole: payload.memberRole,
    };
  }
}
