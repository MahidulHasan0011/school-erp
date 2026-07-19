import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';

/**
 * WebSocket module — socket auth-এর জন্য JwtModule দরকার (access token verify)।
 * RedisService global (RedisModule @Global), তাই আলাদা import লাগে না।
 * EventsGateway export করা হয় যাতে অন্য module (notifications) push করতে পারে।
 */
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
      }),
    }),
  ],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class WebsocketModule {}
