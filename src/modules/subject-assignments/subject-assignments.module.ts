import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubjectAssignment } from './entities/subject-assignment.entity';
import { SubjectAssignmentsController } from './subject-assignments.controller';
import { SubjectAssignmentsRepository } from './subject-assignments.repository';
import { SubjectAssignmentsService } from './subject-assignments.service';

@Module({
  imports: [TypeOrmModule.forFeature([SubjectAssignment])],
  controllers: [SubjectAssignmentsController],
  providers: [SubjectAssignmentsService, SubjectAssignmentsRepository],
  exports: [SubjectAssignmentsService, SubjectAssignmentsRepository],
})
export class SubjectAssignmentsModule {}
