import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

/**
 * Global Redis module — একটাই ioredis client পুরো অ্যাপে share হয়।
 * যেকোনো module RedisService inject করতে পারবে (auth session, cache ইত্যাদি)।
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis({
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password'),
          // cloud Redis হলে TLS (Upstash ইত্যাদি)
          tls: config.get<boolean>('redis.tls') ? {} : undefined,
          // request fail হলে অসীম retry না করে null — দ্রুত error ফেরত
          maxRetriesPerRequest: null,
        }),
    },
    RedisService,
  ],
  exports: [RedisService, REDIS_CLIENT],
})
export class RedisModule {}
