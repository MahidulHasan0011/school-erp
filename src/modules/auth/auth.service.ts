import { randomUUID } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { RedisService } from '../../common/redis/redis.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { durationToSeconds, sessionKey } from './session.util';
import { JwtPayload } from './strategies/jwt.strategy';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  /** email/password যাচাই করে token + user ফেরত দেয়। */
  async login(dto: LoginDto): Promise<AuthTokens & { user: User }> {
    const user = await this.usersService.validateCredentials(
      dto.email,
      dto.password,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // নতুন login = নতুন session
    const tokens = await this.buildTokens(user, randomUUID());
    return { ...tokens, user };
  }

  /** refresh token যাচাই করে নতুন access + refresh token দেয় (একই session)। */
  async refresh(dto: RefreshTokenDto): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // session এখনো valid কি না — logout করলে Redis-এ থাকবে না
    if (!payload.sid || !(await this.redis.exists(sessionKey(payload.sid)))) {
      throw new UnauthorizedException('Session expired or logged out');
    }

    // user এখনো আছে কি না নিশ্চিত করি (মুছে গেলে token অকেজো)
    const user = await this.usersService.findOne(payload.sub);

    // একই sid রেখে token rotate — session TTL-ও extend হয়
    return this.buildTokens(user, payload.sid);
  }

  /** session Redis থেকে মুছে দেয় → ঐ session-এর access+refresh দুটোই সাথে সাথে invalid। */
  async logout(sid?: string): Promise<{ message: string }> {
    if (sid) {
      await this.redis.del(sessionKey(sid));
    }
    return { message: 'Logged out successfully' };
  }

  /**
   * access token (roles+permissions সহ) + refresh token বানায়,
   * এবং sid দিয়ে Redis-এ session store/extend করে।
   */
  private async buildTokens(user: User, sid: string): Promise<AuthTokens> {
    const { roles, permissions } = await this.usersService.getAccessControl(
      user.id,
    );

    const refreshExpires =
      this.config.get<string>('jwt.refreshExpiresIn') ?? '7d';

    // Redis-এ session store — TTL = refresh token lifetime
    await this.redis.setEx(
      sessionKey(sid),
      user.id,
      durationToSeconds(refreshExpires),
    );

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles,
      permissions,
      sid,
    };

    const accessOptions = {
      secret: this.config.get<string>('jwt.secret'),
      expiresIn: this.config.get<string>('jwt.expiresIn') ?? '1d',
    } as JwtSignOptions;

    const refreshOptions = {
      secret: this.config.get<string>('jwt.refreshSecret'),
      expiresIn: refreshExpires,
    } as JwtSignOptions;

    const accessToken = await this.jwtService.signAsync(payload, accessOptions);

    // refresh token-এ identity + sid (permission নয় — refresh-এ fresh লোড হবে)
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, sid },
      refreshOptions,
    );

    return { accessToken, refreshToken };
  }
}
