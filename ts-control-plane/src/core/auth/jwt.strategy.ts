import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export function extractJwtFromCookie(req: any) {
  const cookieHeader = req?.headers?.cookie;
  if (!cookieHeader) {
    return null;
  }

  const tokenCookie = cookieHeader
    .split(';')
    .map((cookie: string) => cookie.trim())
    .find((cookie: string) => cookie.startsWith('agenthub_token='));

  return tokenCookie ? decodeURIComponent(tokenCookie.slice('agenthub_token='.length)) : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractJwtFromCookie,
      ]),
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
