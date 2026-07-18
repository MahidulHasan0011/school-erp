import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicSessionsModule } from '../academic-sessions/academic-sessions.module';
import { ClassesModule } from '../classes/classes.module';
import { ExamResult } from '../exam-results/entities/exam-result.entity';
import { Exam } from '../exams/entities/exam.entity';
import { RankingLocksModule } from '../ranking-locks/ranking-locks.module';
import { Section } from '../sections/entities/section.entity';
import { StudentEnrollment } from '../student-enrollments/entities/student-enrollment.entity';
import { RankingEngine } from './engine/ranking.engine';
import { RollEngine } from './engine/roll.engine';
import { RankingAuditLog } from './entities/ranking-audit-log.entity';
import { RankingHistory } from './entities/ranking-history.entity';
import { RankingJob } from './job/ranking.job';
import { RollJob } from './job/roll.job';
import { RankingQueue } from './queue/ranking.queue';
import { RollQueue } from './queue/roll.queue';
import { RankingController } from './ranking.controller';
import { RankingRepository } from './ranking.repository';
import { RankingService } from './ranking.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RankingHistory,
      RankingAuditLog,
      Exam,
      ExamResult,
      StudentEnrollment,
      Section,
    ]),
    RankingLocksModule,
    AcademicSessionsModule,
    ClassesModule,
  ],
  controllers: [RankingController],
  providers: [
    RankingService,
    RankingRepository,
    RankingEngine, // engine/ — ranking calculation
    RollEngine, // engine/ — roll assignment + transaction
    RankingQueue, // queue/ — STEP 1 producer
    RollQueue, // queue/ — STEP 2 producer
    RankingJob, // job/   — STEP 1 worker (rankedList)
    RollJob, // job/   — STEP 2 worker (roll assign)
  ],
  exports: [RankingService],
})
export class RankingModule {}
