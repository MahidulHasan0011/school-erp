import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RedisService } from '../../../common/redis/redis.service';
import { sessionKey } from '../session.util';

export interface JwtPayload {
  sub: string;
  email: string;
  roles?: string[];
  permissions?: string[];
  sid?: string; // session id — Redis-এ track হয়, logout-এ মুছে দেওয়া হয়
}

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  sid?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret') ?? 'change-me-in-env',
    });
  }

  // Return value request.user-এ attach হয়। session revoked হলে reject।
  async validate(payload: JwtPayload): Promise<AuthUser> {
    // sid থাকলে Redis-এ session আছে কিনা যাচাই — logout করলে থাকবে না
    if (payload.sid) {
      const alive = await this.redis.exists(sessionKey(payload.sid));
      if (!alive) {
        throw new UnauthorizedException('Session expired or logged out');
      }
    }

    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
      sid: payload.sid,
    };
  }
}
