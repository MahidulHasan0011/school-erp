import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamsModule } from '../exams/exams.module';
import { ExamResult } from './entities/exam-result.entity';
import { ExamResultsController } from './exam-results.controller';
import { ExamResultsRepository } from './exam-results.repository';
import { ExamResultsService } from './exam-results.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExamResult]), ExamsModule],
  controllers: [ExamResultsController],
  providers: [ExamResultsService, ExamResultsRepository],
  exports: [ExamResultsService, ExamResultsRepository],
})
export class ExamResultsModule {}