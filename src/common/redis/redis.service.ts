import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/**
 * ioredis client-এর পাতলা wrapper — auth session, cache ইত্যাদির জন্য
 * সহজ get/set/del/exists helper।
 */
@Injectable()
export class RedisService {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  /** TTL (সেকেন্ড) সহ একটি key সেট করে। */
  async setEx(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /** key আছে কিনা (session valid কিনা যাচাই করতে)। */
  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }
}
