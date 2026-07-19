import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../common/redis/redis.service';
import { sessionKey } from '../modules/auth/session.util';
import { JwtPayload } from '../modules/auth/strategies/jwt.strategy';

/** একজন user-এর জন্য room নাম — per-user push এই room-এ যায়। */
const userRoom = (userId: string): string => `user:${userId}`;

/**
 * Socket.IO gateway (namespace `/events`)।
 *
 * প্রতিটা connection JWT দিয়ে auth হয় (HTTP-এর মতোই secret + Redis session check)।
 * auth সফল হলে socket-কে `user:<id>` room-এ ঢোকানো হয়, তাই server নির্দিষ্ট
 * user-কে সরাসরি push করতে পারে (emitToUser) — সবাইকে broadcast না করেই।
 *
 * Client connect উদাহরণ:
 *   io('http://host/events', { auth: { token: '<accessToken>' } })
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/events' })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new Error('No auth token');
      }
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('jwt.secret'),
      });

      // HTTP auth-এর মতোই: sid থাকলে Redis-এ session বেঁচে আছে কিনা যাচাই
      if (payload.sid && !(await this.redis.exists(sessionKey(payload.sid)))) {
        throw new Error('Session expired or logged out');
      }

      // socket-কে নিজের user room-এ ঢোকাই + পরে ব্যবহারের জন্য id রাখি
      (client.data as { userId?: string }).userId = payload.sub;
      await client.join(userRoom(payload.sub));
      this.logger.log(`Client connected: ${client.id} (user ${payload.sub})`);
    } catch (err) {
      this.logger.warn(
        `Socket auth ব্যর্থ (${client.id}): ${(err as Error).message}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('ping')
  handlePing(): string {
    return 'pong';
  }

  /** নির্দিষ্ট user-কে event push (তার সব ডিভাইস/tab-এ)। */
  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(userRoom(userId)).emit(event, payload);
  }

  /** সব connected client-কে broadcast (general event)। */
  emitEvent(event: string, payload: unknown): void {
    this.server.emit(event, payload);
  }

  /** handshake.auth.token → query.token → Authorization header ক্রমে token খোঁজে। */
  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token) {
      return auth.token;
    }
    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string') {
      return queryToken;
    }
    const header = client.handshake.headers?.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice(7);
    }
    return null;
  }
}
