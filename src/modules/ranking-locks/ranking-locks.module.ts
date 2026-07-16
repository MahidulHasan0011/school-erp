import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RankingLock } from './entities/ranking-lock.entity';
import { RankingLocksController } from './ranking-locks.controller';
import { RankingLocksRepository } from './ranking-locks.repository';
import { RankingLocksService } from './ranking-locks.service';

@Module({
  imports: [TypeOrmModule.forFeature([RankingLock])],
  controllers: [RankingLocksController],
  providers: [RankingLocksService, RankingLocksRepository],
  // ranking module lock/unlock ব্যবহার করবে, তাই export
  exports: [RankingLocksService, RankingLocksRepository],
})
export class RankingLocksModule {}
