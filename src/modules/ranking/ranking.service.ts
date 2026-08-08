import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RabbitMQService } from '../../common/rabbitmq/rabbitmq.service';
import { RedisService } from '../../common/redis/redis.service';
import { AcademicSessionsRepository } from '../academic-sessions/academic-sessions.repository';
import { ClassesRepository } from '../classes/classes.repository';
import { RankingLocksService } from '../ranking-locks/ranking-locks.service';
import { GenerateRollDto } from './dto/generate-roll.dto';
import { HistoryQueryDto } from './dto/history-query.dto';
import { RankingEngine } from './engine/ranking.engine';
import { RollEngine } from './engine/roll.engine';
import { RankingAction } from './entities/ranking-audit-log.entity';
import { RankingQueue } from './queue/ranking.queue';
import { RollQueue } from './queue/roll.queue';
import {
  RANKING_QUEUE,
  ROLL_QUEUE,
  RankingJobPayload,
  RankingJobStatus,
  RollJobPayload,
  RollListEntry,
} from './ranking.constants';
import { RankingRepository } from './ranking.repository';

/**
 * Orchestration layer — validation, queue-তে job পাঠানো, worker-এর জন্য
 * processJob, এবং read/status। ভারী calculation engine/-এ, transport queue/job/-এ।
 */
@Injectable()
export class RankingService {
  private readonly logger = new Logger(RankingService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly rankingRepository: RankingRepository,
    private readonly rankingLocksService: RankingLocksService,
    private readonly sessionsRepository: AcademicSessionsRepository,
    private readonly classesRepository: ClassesRepository,
    private readonly rankingQueue: RankingQueue,
    private readonly rollQueue: RollQueue,
    private readonly rankingEngine: RankingEngine,
    private readonly rollEngine: RollEngine,
    private readonly redis: RedisService,
    private readonly rabbitmq: RabbitMQService,
  ) {}

  // ═══════════════════ WRITE — request (validate + queue) ═══════════════════

  /** Manual generate — validation করে queue-তে পাঠায় (locked হলে 409)। */
  async requestGenerate(dto: GenerateRollDto, triggeredBy: string) {
    const admissionTestEnabled = await this.loadClassAndSession(
      dto.classId,
      dto.academicSessionId,
    );
    if (
      await this.rankingLocksService.isLocked(
        dto.classId,
        dto.academicSessionId,
      )
    ) {
      throw new ConflictException(
        'Ranking is locked for this class+session — use recalculate instead',
      );
    }
    await this.assertExamsReady(
      dto.classId,
      dto.academicSessionId,
      admissionTestEnabled,
    );
    return this.enqueue('GENERATE', dto, triggeredBy);
  }

  /**
   * Admin recalculate — locked অবস্থার উপরেই চলে।
   *
   * এখানে আগে থেকে unlock করা হয় না (আগে করা হতো)। কারণ publish ব্যর্থ হলে ক্লাস
   * unlocked অবস্থায় পড়ে থাকত পুরনো roll নিয়ে, আর যে কেউ তখন generate চালিয়ে
   * দিতে পারত। RollEngine কাজ শেষে lock নতুন করে বসায়, আর worker-এর lock check
   * শুধু GENERATE-এর জন্য — তাই আগাম unlock-এর কোনো প্রয়োজনই নেই।
   */
  async requestRecalculate(dto: GenerateRollDto, triggeredBy: string) {
    const admissionTestEnabled = await this.loadClassAndSession(
      dto.classId,
      dto.academicSessionId,
    );
    await this.assertExamsReady(
      dto.classId,
      dto.academicSessionId,
      admissionTestEnabled,
    );
    return this.enqueue('RECALCULATE', dto, triggeredBy);
  }

  private async enqueue(
    action: RankingJobPayload['action'],
    dto: GenerateRollDto,
    triggeredBy: string,
  ) {
    const payload: RankingJobPayload = {
      action,
      classId: dto.classId,
      academicSessionId: dto.academicSessionId,
      triggeredBy,
    };
    // status আগে লিখি (worker-এর 'processing' যেন পরে overwrite না হয়), আর
    // publish ব্যর্থ হলে status পরিষ্কার করে দিই — নইলে queue-তে কিছু না থাকা
    // সত্ত্বেও ইউজার চিরকাল 'queued' দেখত।
    await this.setJobStatus(dto.classId, dto.academicSessionId, 'queued', {
      action,
    });
    try {
      await this.rankingQueue.publish(payload);
    } catch (err) {
      await this.trySetJobStatus(dto.classId, dto.academicSessionId, 'failed', {
        action,
        stage: 'enqueue',
        error: (err as Error).message,
      });
      throw err;
    }
    return {
      status: 'queued' as const,
      action,
      classId: dto.classId,
      academicSessionId: dto.academicSessionId,
      message:
        'Ranking job queued — GET /ranking/:classId/:sessionId দিয়ে ফলাফল দেখুন',
    };
  }

  // ═══════════════════ WORKER entry point ═══════════════════

  /**
   * STEP 1 — job/ranking.job.ts কল করে: rankedList তৈরি করে roll queue-তে পাঠায়।
   * ভারী calculation RankingEngine-এ। ব্যর্থ হলে throw → RabbitMQ backoff retry।
   */
  async processRankingJob(payload: RankingJobPayload): Promise<void> {
    const { classId, academicSessionId, action } = payload;
    await this.setJobStatus(classId, academicSessionId, 'processing', {
      action,
      stage: 'ranking',
    });
    try {
      const admissionTestEnabled = await this.loadClassAndSession(
        classId,
        academicSessionId,
      );

      // GENERATE হলে দ্রুত skip — এর মধ্যে অন্য কেউ lock করলে ভারী হিসাব বাদ।
      // (চূড়ান্ত ও নির্ভরযোগ্য check RollEngine-এর transaction-এর ভেতরে।)
      if (action === 'GENERATE') {
        const locked = await this.rankingLocksService.isLocked(
          classId,
          academicSessionId,
        );
        if (locked) {
          await this.setJobStatus(classId, academicSessionId, 'completed', {
            action,
            skipped: 'already-locked',
          });
          return;
        }
      }

      const ranked = await this.rankingEngine.buildCombinedRanking(
        classId,
        academicSessionId,
        admissionTestEnabled,
      );

      // STEP 2-এ pass — RollEngine-এর যতটা দরকার ততটুকুই পাঠাই (message ছোট রাখে)
      const rankedList: RollListEntry[] = ranked.map((r) => ({
        studentId: r.studentId,
        rankPosition: r.rankPosition,
        totalScore: r.totalScore,
      }));
      await this.rollQueue.publish({ ...payload, rankedList });
    } catch (err) {
      await this.trySetJobStatus(classId, academicSessionId, 'failed', {
        action,
        stage: 'ranking',
        error: (err as Error).message,
      });
      throw err; // RabbitMQ retry (exponential backoff) trigger করতে
    }
  }

  /**
   * STEP 2 — job/roll.job.ts কল করে: rankedList থেকে roll assign + history +
   * lock + audit (RollEngine, এক transaction)। ব্যর্থ হলে throw → backoff retry।
   */
  async processRollJob(payload: RollJobPayload): Promise<void> {
    const { classId, academicSessionId, action, triggeredBy, rankedList } =
      payload;
    await this.setJobStatus(classId, academicSessionId, 'processing', {
      action,
      stage: 'roll',
    });

    let result: Awaited<ReturnType<RollEngine['generateRolls']>>;
    try {
      result = await this.rollEngine.generateRolls(
        { classId, academicSessionId },
        rankedList,
        triggeredBy,
        action === 'GENERATE'
          ? RankingAction.GENERATE
          : RankingAction.RECALCULATE,
      );
    } catch (err) {
      await this.trySetJobStatus(classId, academicSessionId, 'failed', {
        action,
        stage: 'roll',
        error: (err as Error).message,
      });
      throw err;
    }

    // ⚠️ এই বিন্দুর পরে transaction commit হয়ে গেছে — কাজ সম্পন্ন। status লেখা
    // ব্যর্থ হলে throw করা যাবে না, কারণ তাহলে RabbitMQ পুরো roll job আবার
    // চালাবে এবং একই ডেটার আরেকটা version তৈরি হবে। status হারানো তুচ্ছ ক্ষতি;
    // কাজ দুইবার হওয়া নয়।
    await this.trySetJobStatus(
      classId,
      academicSessionId,
      'completed',
      result.skipped
        ? { action, skipped: 'already-locked' }
        : {
            action,
            version: result.version,
            studentCount: result.studentCount,
          },
    );
  }

  /** শুধু unlock (regenerate ছাড়া)। */
  async unlock(classId: string, academicSessionId: string, actorId: string) {
    await this.loadClassAndSession(classId, academicSessionId);
    // unlock ও তার audit log একই transaction-এ — audit লেখা ব্যর্থ হলে unlock-ও
    // rollback হবে, তাই "কে খুলল" রেকর্ড ছাড়া কখনো খোলা থাকে না।
    const lock = await this.dataSource.transaction(async (manager) => {
      const updated = await this.rankingLocksService.unlock(
        classId,
        academicSessionId,
        manager,
      );
      await this.rankingRepository.logAudit(manager, {
        action: RankingAction.UNLOCK,
        classId,
        academicSessionId,
        actorId,
        detail: { context: 'manual-unlock' },
      });
      return updated;
    });
    return { message: 'Ranking unlocked', lock };
  }

  // ═══════════════════ READ ═══════════════════

  async getRanking(classId: string, academicSessionId: string) {
    await this.loadClassAndSession(classId, academicSessionId);
    const jobStatus = await this.getJobStatus(classId, academicSessionId);
    const version = await this.rankingRepository.getLatestVersion(
      classId,
      academicSessionId,
    );
    if (version === null) {
      return {
        classId,
        academicSessionId,
        version: null,
        jobStatus,
        ranking: [],
      };
    }
    const ranking = await this.rankingRepository.getSnapshot(
      classId,
      academicSessionId,
      version,
    );
    return { classId, academicSessionId, version, jobStatus, ranking };
  }

  async getHistory(
    classId: string,
    academicSessionId: string,
    query: HistoryQueryDto,
  ) {
    await this.loadClassAndSession(classId, academicSessionId);
    if (query.version) {
      const snapshot = await this.rankingRepository.getSnapshot(
        classId,
        academicSessionId,
        query.version,
      );
      return { classId, academicSessionId, version: query.version, snapshot };
    }
    const versions = await this.rankingRepository.getVersionList(
      classId,
      academicSessionId,
    );
    return { classId, academicSessionId, versions };
  }

  async getAuditLog(classId: string, academicSessionId: string) {
    await this.loadClassAndSession(classId, academicSessionId);
    const logs = await this.rankingRepository.getAuditLog(
      classId,
      academicSessionId,
    );
    return { classId, academicSessionId, logs };
  }

  /** সর্বশেষ ranking job-এর status (queued/processing/completed/failed)। */
  async getJobStatus(classId: string, academicSessionId: string) {
    const raw = await this.redis.get(this.jobKey(classId, academicSessionId));
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  }

  // ═══════════════════ DLQ (parking lot) — admin ═══════════════════

  /**
   * দুই queue-এর DLQ-তে পার্ক হওয়া ব্যর্থ job-গুলো non-destructive ভাবে দেখায়
   * (সব retry শেষ হওয়ার পরও যেগুলো ব্যর্থ)। শুধু inspect — কিছু মুছে/সরায় না।
   * `total`/`truncated` দেখে বোঝা যায় limit-এ কাটা পড়েছে কিনা।
   */
  async getDeadLetters() {
    const [ranking, roll] = await Promise.all([
      this.rabbitmq.peekDlq(RANKING_QUEUE),
      this.rabbitmq.peekDlq(ROLL_QUEUE),
    ]);
    return {
      ranking,
      roll,
      total: ranking.total + roll.total,
    };
  }

  /**
   * DLQ-এর job গুলো আবার main queue-তে ফেরত পাঠায় (attempts reset করে) —
   * সমস্যা fix হওয়ার পর manually re-process করার জন্য।
   */
  async replayDeadLetters() {
    const [ranking, roll] = await Promise.all([
      this.rabbitmq.replayDlq(RANKING_QUEUE),
      this.rabbitmq.replayDlq(ROLL_QUEUE),
    ]);
    return {
      replayed: { ranking, roll, total: ranking + roll },
      message: `${ranking + roll}টি job DLQ থেকে queue-তে ফেরত পাঠানো হয়েছে`,
    };
  }

  // ═══════════════════ helpers ═══════════════════

  private jobKey(classId: string, academicSessionId: string): string {
    return `ranking:job:${classId}:${academicSessionId}`;
  }

  private async setJobStatus(
    classId: string,
    academicSessionId: string,
    status: RankingJobStatus,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    const value = JSON.stringify({
      status,
      ...extra,
      at: new Date().toISOString(),
    });
    await this.redis.setEx(
      this.jobKey(classId, academicSessionId),
      value,
      86400,
    );
  }

  /**
   * status লেখার best-effort সংস্করণ — কখনো throw করে না।
   *
   * দুই জায়গায় দরকার: (১) `catch` ব্লকের ভেতরে — Redis down থাকলে এই লেখাটাই
   * throw করে আসল error ঢেকে দিত; (২) কাজ commit হয়ে যাওয়ার পরে — তখন throw
   * করলে অকারণে পুরো job retry হতো।
   */
  private async trySetJobStatus(
    classId: string,
    academicSessionId: string,
    status: RankingJobStatus,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      await this.setJobStatus(classId, academicSessionId, status, extra);
    } catch (err) {
      this.logger.warn(
        `job status (${status}) লেখা যায়নি ${classId}/${academicSessionId}: ${(err as Error).message}`,
      );
    }
  }

  /** class + session আছে কিনা যাচাই; session-এর admissionTestEnabled ফেরত দেয়। */
  private async loadClassAndSession(
    classId: string,
    academicSessionId: string,
  ): Promise<boolean> {
    const cls = await this.classesRepository.findById(classId);
    if (!cls) {
      throw new NotFoundException('Class not found');
    }
    const session = await this.sessionsRepository.findById(academicSessionId);
    if (!session) {
      throw new NotFoundException('Academic session not found');
    }
    return session.admissionTestEnabled === true;
  }

  /** FINAL (ও admission হলে ADMISSION) exam PUBLISHED কিনা — নাহলে 400। */
  private async assertExamsReady(
    classId: string,
    academicSessionId: string,
    admissionTestEnabled: boolean,
  ): Promise<void> {
    const finalReady = await this.rankingRepository.isExamPublished(
      classId,
      academicSessionId,
      'FINAL',
    );
    if (!finalReady) {
      throw new BadRequestException(
        'FINAL exam must be PUBLISHED before ranking',
      );
    }
    if (admissionTestEnabled) {
      const admissionReady = await this.rankingRepository.isExamPublished(
        classId,
        academicSessionId,
        'ADMISSION',
      );
      if (!admissionReady) {
        throw new BadRequestException(
          'ADMISSION exam must be PUBLISHED (admission test enabled)',
        );
      }
    }
  }
}
