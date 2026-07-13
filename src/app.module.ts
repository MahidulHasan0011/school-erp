import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import storageConfig from './config/storage.config';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, redisConfig, storageConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('database.url'),
        autoLoadEntities: true,
        // Supabase-এ SSL বাধ্যতামূলক
        ssl: { rejectUnauthorized: false },
        // ⚠️ ডাটাবেসে আগে থেকেই স্কিমা ডিজাইন করা আছে (database-first)।
        // synchronize কখনোই true করবেন না — তাহলে TypeORM আসল টেবিল বদলে/মুছে ফেলবে।
        // স্কিমা পরিবর্তন করতে হলে migration ব্যবহার করুন।
        synchronize: false,
      }),
    }),
    RedisModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
