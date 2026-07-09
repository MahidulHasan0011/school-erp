import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        // Supabase-এ SSL বাধ্যতামূলক
        ssl: { rejectUnauthorized: false },
        // ডেভেলপমেন্টে true; প্রোডাকশনে migration ব্যবহার করুন
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
