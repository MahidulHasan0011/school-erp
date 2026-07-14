import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubjectAssignment } from '../subject-assignments/entities/subject-assignment.entity';
import { UsersModule } from '../users/users.module';
import { Teacher } from './entities/teacher.entity';
import { TeachersController } from './teachers.controller';
import { TeachersRepository } from './teachers.repository';
import { TeachersService } from './teachers.service';

@Module({
  imports: [
    // SubjectAssignment এখানে register করা হচ্ছে যাতে autoLoadEntities এটি চেনে
    // (Phase 4-এ subject-assignments module পুরো হলে সেখানে move হবে)
    TypeOrmModule.forFeature([Teacher, SubjectAssignment]),
    UsersModule,
  ],
  controllers: [TeachersController],
  providers: [TeachersService, TeachersRepository],
  exports: [TeachersService, TeachersRepository],
})
export class TeachersModule {}
