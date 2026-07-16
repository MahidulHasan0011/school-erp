import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { RankingLock } from './entities/ranking-lock.entity';

@Injectable()
export class RankingLocksRepository {
  constructor(
    @InjectRepository(RankingLock)
    private readonly repo: Repository<RankingLock>,
  ) {}

  /**
   * transaction manager দিলে সেটার query, নইলে default repo-এর manager।
   * এতে ranking roll-engine lock-কে তার নিজের transaction-এ (roll+history+lock
   * atomic) অন্তর্ভুক্ত করতে পারে।
   */
  private exec(manager?: EntityManager): EntityManager {
    return manager ?? this.repo.manager;
  }

  /** lock row আছে কিনা — না থাকলে unlocked ধরা হয় (প্রথমবার)। */
  findByClassAndSession(
    classId: string,
    academicSessionId: string,
  ): Promise<RankingLock | null> {
    return this.repo.findOne({
      where: { classId, academicSessionId },
      relations: { class: true, academicSession: true, lockedByUser: true },
    });
  }

  async isLocked(
    classId: string,
    academicSessionId: string,
  ): Promise<boolean> {
    const lock = await this.repo.findOne({
      where: { classId, academicSessionId },
    });
    return lock?.isLocked === true;
  }

  /**
   * lock row না থাকলে তৈরি করে lock করে, থাকলে আপডেট — upsert।
   * (class_id, academic_session_id) unique-এর উপর ON CONFLICT।
   */
  async lock(
    classId: string,
    academicSessionId: string,
    lockedBy: string | null,
    manager?: EntityManager,
  ): Promise<RankingLock> {
    const rows: RankingLock[] = await this.exec(manager).query(
      `INSERT INTO ranking_locks
         (class_id, academic_session_id, is_locked, locked_at, locked_by)
       VALUES ($1, $2, true, NOW(), $3)
       ON CONFLICT (class_id, academic_session_id)
       DO UPDATE SET is_locked = true, locked_at = NOW(),
                     locked_by = $3, updated_at = NOW()
       RETURNING *`,
      [classId, academicSessionId, lockedBy],
    );
    return rows[0];
  }

  async unlock(
    classId: string,
    academicSessionId: string,
    manager?: EntityManager,
  ): Promise<RankingLock> {
    const rows: RankingLock[] = await this.exec(manager).query(
      `INSERT INTO ranking_locks
         (class_id, academic_session_id, is_locked, locked_at, locked_by)
       VALUES ($1, $2, false, NULL, NULL)
       ON CONFLICT (class_id, academic_session_id)
       DO UPDATE SET is_locked = false, locked_at = NULL,
                     locked_by = NULL, updated_at = NOW()
       RETURNING *`,
      [classId, academicSessionId],
    );
    return rows[0];
  }
}
