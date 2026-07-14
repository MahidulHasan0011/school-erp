import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicSessionsController } from './academic-sessions.controller';
import { AcademicSessionsRepository } from './academic-sessions.repository';
import { AcademicSessionsService } from './academic-sessions.service';
import { AcademicSession } from './entities/academic-session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AcademicSession])],
  controllers: [AcademicSessionsController],
  providers: [AcademicSessionsService, AcademicSessionsRepository],
  exports: [AcademicSessionsService, AcademicSessionsRepository],
})
export class AcademicSessionsModule {}
