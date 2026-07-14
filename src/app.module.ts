import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import storageConfig from './config/storage.config';
import { RedisModule } from './common/redis/redis.module';
import { AcademicSessionsModule } from './modules/academic-sessions/academic-sessions.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClassesModule } from './modules/classes/classes.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { RolePermissionsModule } from './modules/role-permissions/role-permissions.module';
import { RolesModule } from './modules/roles/roles.module';
import { SectionsModule } from './modules/sections/sections.module';
import { StudentEnrollmentsModule } from './modules/student-enrollments/student-enrollments.module';
import { StudentsModule } from './modules/students/students.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { TeachersModule } from './modules/teachers/teachers.module';
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
    PermissionsModule,
    RolesModule,
    RolePermissionsModule,
    TeachersModule,
    StudentsModule,
    StudentEnrollmentsModule,
    ClassesModule,
    SectionsModule,
    SubjectsModule,
    AcademicSessionsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
