import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ExamResult } from '../exam-results/entities/exam-result.entity';
import { Exam, ExamStatus, ExamType } from '../exams/entities/exam.entity';
import { Section } from '../sections/entities/section.entity';
import { StudentEnrollment } from '../student-enrollments/entities/student-enrollment.entity';
import { Student } from '../students/entities/student.entity';
import { User } from '../users/entities/user.entity';
import { RankingAction } from './entities/ranking-audit-log.entity';
import { RankingAuditLog } from './entities/ranking-audit-log.entity';
import { RankingHistory } from './entities/ranking-history.entity';

export interface MeritRow {
  student_id: string;
  total_score: string;
  final_score: string;
  midterm_score: string;
  admission_date: string | null;
  enrollment_created_at: string;
  rank_position: string;
}

export interface NewStudentRow {
  student_id: string;
  admission_date: string | null;
  enrollment_created_at: string;
}

export interface SectionRow {
  id: string;
  name: string;
  max_capacity: number | null;
}

/**
 * Ranking data access — যতটা সম্ভব TypeORM (QueryBuilder/Repository)।
 * শুধু দুটি জিনিস raw:
 *   1. advisoryLock  — pg_advisory_xact_lock(), TypeORM-এ API নেই (Postgres-specific)।
 *   2. getMeritList  — database VIEW `student_merit_list` পড়ে; ranking SQL logic
 *      view-তেই (migration 008) থাকে, এখানে শুধু SELECT।
 */
@Injectable()
export class RankingRepository {
  constructor(
    @InjectRepository(RankingHistory)
    private readonly historyRepo: Repository<RankingHistory>,
    @InjectRepository(RankingAuditLog)
    private readonly auditRepo: Repository<RankingAuditLog>,
    @InjectRepository(Exam)
    private readonly examRepo: Repository<Exam>,
    @InjectRepository(ExamResult)
    private readonly examResultRepo: Repository<ExamResult>,
    @InjectRepository(StudentEnrollment)
    private readonly enrollmentRepo: Repository<StudentEnrollment>,
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
  ) {}

  // ── exam-ready checks ──

  /** class+session-এ প্রদত্ত type-এর কোনো PUBLISHED exam আছে কিনা। */
  async isExamPublished(
    classId: string,
    academicSessionId: string,
    examType: 'FINAL' | 'ADMISSION',
  ): Promise<boolean> {
    // count() soft-deleted (deleted_at) row বাদ দেয় স্বয়ংক্রিয়ভাবে
    const count = await this.examRepo.count({
      where: {
        classId,
        academicSessionId,
        examType: examType as ExamType,
        status: ExamStatus.PUBLISHED,
      },
    });
    return count > 0;
  }

  // ── ranking source data ──

  /**
   * OLD student merit list — database VIEW `student_merit_list` থেকে (rank_position সহ)।
   * View-এর SQL (RANK() window + tie-break) migration 008-এ; এখানে শুধু পড়া।
   */
  getMeritList(
    classId: string,
    academicSessionId: string,
  ): Promise<MeritRow[]> {
    return this.historyRepo.manager.query(
      `SELECT student_id, total_score, final_score, midterm_score,
              admission_date, enrollment_created_at, rank_position
         FROM public.student_merit_list
        WHERE class_id = $1 AND academic_session_id = $2
        ORDER BY rank_position ASC`,
      [classId, academicSessionId],
    );
  }

  /** merit list-এ নেই এমন enrolled student (FIFO — admission_date, created_at ক্রমে)। */
  async getNewStudents(
    classId: string,
    academicSessionId: string,
    excludeIds: string[],
  ): Promise<NewStudentRow[]> {
    const qb = this.enrollmentRepo
      .createQueryBuilder('se')
      .select('se.studentId', 'student_id')
      .addSelect('se.admissionDate', 'admission_date')
      .addSelect('se.createdAt', 'enrollment_created_at')
      .where('se.classId = :classId', { classId })
      .andWhere('se.academicSessionId = :academicSessionId', {
        academicSessionId,
      })
      .andWhere('se.deletedAt IS NULL');

    // NOT IN খালি array-তে ভাঙে — তাই id থাকলে তবেই যোগ করি
    if (excludeIds.length > 0) {
      qb.andWhere('se.studentId NOT IN (:...excludeIds)', { excludeIds });
    }

    return qb
      .orderBy('se.admissionDate', 'ASC', 'NULLS LAST')
      .addOrderBy('se.createdAt', 'ASC')
      .getRawMany<NewStudentRow>();
  }

  /** নির্দিষ্ট student-দের ADMISSION exam total (published)। */
  async getAdmissionScores(
    classId: string,
    academicSessionId: string,
    studentIds: string[],
  ): Promise<Array<{ student_id: string; admission_score: string }>> {
    if (studentIds.length === 0) return [];
    return this.examResultRepo
      .createQueryBuilder('er')
      .innerJoin(Exam, 'e', 'e.id = er.examId')
      .select('er.studentId', 'student_id')
      .addSelect('COALESCE(SUM(er.marks), 0)', 'admission_score')
      .where('e.classId = :classId', { classId })
      .andWhere('e.academicSessionId = :academicSessionId', {
        academicSessionId,
      })
      .andWhere('e.examType = :examType', { examType: ExamType.ADMISSION })
      .andWhere('e.status = :status', { status: ExamStatus.PUBLISHED })
      .andWhere('er.deletedAt IS NULL')
      .andWhere('e.deletedAt IS NULL')
      .andWhere('er.studentId IN (:...studentIds)', { studentIds })
      .groupBy('er.studentId')
      .getRawMany<{ student_id: string; admission_score: string }>();
  }

  /** ক্লাসের section গুলো (capacity সহ, নাম ক্রমে) — distribution-এর জন্য। */
  getSectionsForClass(classId: string): Promise<SectionRow[]> {
    return this.sectionRepo
      .createQueryBuilder('s')
      .select('s.id', 'id')
      .addSelect('s.name', 'name')
      .addSelect('s.maxCapacity', 'max_capacity')
      .where('s.classId = :classId', { classId })
      .andWhere('s.deletedAt IS NULL')
      .orderBy('s.name', 'ASC')
      .getRawMany<SectionRow>();
  }

  // ── transactional write ops (manager আবশ্যক) ──

  /**
   * advisory lock — একই class+session-এ concurrent generation ঠেকায়।
   * pg_advisory_xact_lock()-এর কোনো TypeORM API নেই, তাই raw (Postgres-specific)।
   */
  async advisoryLock(
    manager: EntityManager,
    classId: string,
    academicSessionId: string,
  ): Promise<void> {
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `ranking:${classId}:${academicSessionId}`,
    ]);
  }

  /** student_enrollments-এ roll_number + section_id বসায়। true = update হয়েছে। */
  async assignRollAndSection(
    manager: EntityManager,
    academicSessionId: string,
    studentId: string,
    rollNumber: number,
    sectionId: string | null,
  ): Promise<boolean> {
    const result = await manager
      .createQueryBuilder()
      .update(StudentEnrollment)
      .set({ rollNumber, sectionId, updatedAt: () => 'NOW()' })
      .where('student_id = :studentId', { studentId })
      .andWhere('academic_session_id = :academicSessionId', {
        academicSessionId,
      })
      .andWhere('deleted_at IS NULL')
      .execute();
    return (result.affected ?? 0) > 0;
  }

  async getNextVersion(
    manager: EntityManager,
    classId: string,
    academicSessionId: string,
  ): Promise<number> {
    const row = await manager
      .getRepository(RankingHistory)
      .createQueryBuilder('rh')
      .select('COALESCE(MAX(rh.version), 0)', 'v')
      .where('rh.classId = :classId', { classId })
      .andWhere('rh.academicSessionId = :academicSessionId', {
        academicSessionId,
      })
      .getRawOne<{ v: string }>();
    return Number(row?.v ?? 0) + 1;
  }

  async saveHistoryRow(
    manager: EntityManager,
    row: {
      academicSessionId: string;
      classId: string;
      studentId: string;
      totalScore: number;
      rankPosition: number;
      rollNumber: number;
      version: number;
    },
  ): Promise<void> {
    await manager.getRepository(RankingHistory).insert({
      academicSessionId: row.academicSessionId,
      classId: row.classId,
      studentId: row.studentId,
      totalScore: row.totalScore,
      rankPosition: row.rankPosition,
      rollNumber: row.rollNumber,
      version: row.version,
    });
  }

  async logAudit(
    manager: EntityManager,
    data: {
      action: string;
      classId: string;
      academicSessionId: string;
      actorId: string | null;
      fromVersion?: number | null;
      toVersion?: number | null;
      detail?: Record<string, unknown> | null;
    },
  ): Promise<void> {
    const repo = manager.getRepository(RankingAuditLog);
    // create() plain object → entity; jsonb detail deep-partial টাইপে সমস্যা করে
    // বলে save() ব্যবহার (DeepPartial গ্রহণ করে)
    await repo.save(
      repo.create({
        action: data.action as RankingAction,
        classId: data.classId,
        academicSessionId: data.academicSessionId,
        actorId: data.actorId,
        fromVersion: data.fromVersion ?? null,
        toVersion: data.toVersion ?? null,
        detail: data.detail ?? null,
      }),
    );
  }

  // ── read ops ──

  async getLatestVersion(
    classId: string,
    academicSessionId: string,
  ): Promise<number | null> {
    const row = await this.historyRepo
      .createQueryBuilder('rh')
      .select('MAX(rh.version)', 'v')
      .where('rh.classId = :classId', { classId })
      .andWhere('rh.academicSessionId = :academicSessionId', {
        academicSessionId,
      })
      .getRawOne<{ v: number | null }>();
    return row?.v != null ? Number(row.v) : null;
  }

  getSnapshot(
    classId: string,
    academicSessionId: string,
    version: number,
  ): Promise<unknown[]> {
    return this.historyRepo
      .createQueryBuilder('rh')
      .innerJoin(Student, 's', 's.id = rh.studentId')
      .innerJoin(User, 'u', 'u.id = s.userId')
      .select('rh.studentId', 'student_id')
      .addSelect('rh.totalScore', 'total_score')
      .addSelect('rh.rankPosition', 'rank_position')
      .addSelect('rh.rollNumber', 'roll_number')
      .addSelect('rh.version', 'version')
      .addSelect('rh.generatedAt', 'generated_at')
      .addSelect('s.studentCode', 'student_code')
      .addSelect('u.fullName', 'student_name')
      .where('rh.classId = :classId', { classId })
      .andWhere('rh.academicSessionId = :academicSessionId', {
        academicSessionId,
      })
      .andWhere('rh.version = :version', { version })
      .orderBy('rh.rankPosition', 'ASC')
      .getRawMany();
  }

  getVersionList(
    classId: string,
    academicSessionId: string,
  ): Promise<unknown[]> {
    return this.historyRepo
      .createQueryBuilder('rh')
      .select('rh.version', 'version')
      .addSelect('COUNT(*)::int', 'student_count')
      .addSelect('MAX(rh.generatedAt)', 'generated_at')
      .where('rh.classId = :classId', { classId })
      .andWhere('rh.academicSessionId = :academicSessionId', {
        academicSessionId,
      })
      .groupBy('rh.version')
      .orderBy('rh.version', 'DESC')
      .getRawMany();
  }

  getAuditLog(
    classId: string,
    academicSessionId: string,
  ): Promise<RankingAuditLog[]> {
    return this.auditRepo.find({
      where: { classId, academicSessionId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }
}
