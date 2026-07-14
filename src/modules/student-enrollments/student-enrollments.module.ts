import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentsModule } from '../students/students.module';
import { StudentEnrollment } from './entities/student-enrollment.entity';
import { StudentEnrollmentsController } from './student-enrollments.controller';
import { StudentEnrollmentsRepository } from './student-enrollments.repository';
import { StudentEnrollmentsService } from './student-enrollments.service';

@Module({
  imports: [TypeOrmModule.forFeature([StudentEnrollment]), StudentsModule],
  controllers: [StudentEnrollmentsController],
  providers: [StudentEnrollmentsService, StudentEnrollmentsRepository],
  exports: [StudentEnrollmentsService, StudentEnrollmentsRepository],
})
export class StudentEnrollmentsModule {}
