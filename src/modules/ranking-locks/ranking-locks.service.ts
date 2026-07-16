import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { RankingLock } from './entities/ranking-lock.entity';
import { RankingLocksRepository } from './ranking-locks.repository';

@Injectable()
export class RankingLocksService {
  constructor(
    private readonly rankingLocksRepository: RankingLocksRepository,
  ) {}

  /** class+session-এর lock status — row না থাকলে unlocked ধরে ফেরত দেয়। */
  async getStatus(classId: string, academicSessionId: string) {
    const lock = await this.rankingLocksRepository.findByClassAndSession(
      classId,
      academicSessionId,
    );
    return {
      classId,
      academicSessionId,
      isLocked: lock?.isLocked ?? false,
      lockedAt: lock?.lockedAt ?? null,
      lockedBy: lock?.lockedBy ?? null,
      lock,
    };
  }

  isLocked(classId: string, academicSessionId: string): Promise<boolean> {
    return this.rankingLocksRepository.isLocked(classId, academicSessionId);
  }

  lock(
    classId: string,
    academicSessionId: string,
    lockedBy: string | null,
    manager?: EntityManager,
  ): Promise<RankingLock> {
    return this.rankingLocksRepository.lock(
      classId,
      academicSessionId,
      lockedBy,
      manager,
    );
  }

  unlock(
    classId: string,
    academicSessionId: string,
    manager?: EntityManager,
  ): Promise<RankingLock> {
    return this.rankingLocksRepository.unlock(
      classId,
      academicSessionId,
      manager,
    );
  }
}
