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
  lock(
    classId: string,
    academicSessionId: string,
    lockedBy: string | null,
    manager?: EntityManager,
  ): Promise<RankingLock> {
    return this.writeLock(manager, classId, academicSessionId, true, lockedBy);
  }

  unlock(
    classId: string,
    academicSessionId: string,
    manager?: EntityManager,
  ): Promise<RankingLock> {
    return this.writeLock(manager, classId, academicSessionId, false, null);
  }

  /**
   * lock/unlock-এর common upsert — TypeORM QueryBuilder দিয়ে
   * `INSERT ... ON CONFLICT DO UPDATE ... RETURNING *` (raw SQL string ছাড়া)।
   *
   * - `() => 'NOW()'` দিয়ে timestamp DB-এর ঘড়িতে বসে (app-server time নয়)।
   * - `.orUpdate(overwrite, conflictTarget)` → ON CONFLICT DO UPDATE।
   * - `.returning('*')` → এক round-trip-এ পুরো সারি ফেরত (আলাদা SELECT লাগে না,
   *   roll-engine-এর transaction-এ গুরুত্বপূর্ণ)।
   */
  private async writeLock(
    manager: EntityManager | undefined,
    classId: string,
    academicSessionId: string,
    isLocked: boolean,
    lockedBy: string | null,
  ): Promise<RankingLock> {
    const result = await this.exec(manager)
      .createQueryBuilder()
      .insert()
      .into(RankingLock)
      .values({
        classId,
        academicSessionId,
        isLocked,
        lockedAt: isLocked ? () => 'NOW()' : null,
        lockedBy: isLocked ? lockedBy : null,
        updatedAt: () => 'NOW()',
      })
      .orUpdate(
        ['is_locked', 'locked_at', 'locked_by', 'updated_at'],
        ['class_id', 'academic_session_id'],
      )
      .returning('*')
      .execute();
    return (result.raw as RankingLock[])[0];
  }
}
