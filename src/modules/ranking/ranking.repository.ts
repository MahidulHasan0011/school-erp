import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
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

@Injectable()
export class RankingRepository {
  constructor(
    @InjectRepository(RankingHistory)
    private readonly historyRepo: Repository<RankingHistory>,
  ) {}

  private get em(): EntityManager {
    return this.historyRepo.manager;
  }

  // ── exam-ready checks ──
  async isExamPublished(
    classId: string,
    academicSessionId: string,
    examType: 'FINAL' | 'ADMISSION',
  ): Promise<boolean> {
    const rows: Array<{ count: string }> = await this.em.query(
      `SELECT COUNT(*)::int AS count FROM public.exams
        WHERE class_id = $1 AND academic_session_id = $2
          AND exam_type = $3 AND status = 'PUBLISHED' AND deleted_at IS NULL`,
      [classId, academicSessionId, examType],
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }

  // ── ranking source data ──

  /** OLD student merit list (view থেকে, rank_position সহ)। */
  getMeritList(
    classId: string,
    academicSessionId: string,
  ): Promise<MeritRow[]> {
    return this.em.query(
      `SELECT student_id, total_score, final_score, midterm_score,
              admission_date, enrollment_created_at, rank_position
         FROM public.student_merit_list
        WHERE class_id = $1 AND academic_session_id = $2
        ORDER BY rank_position ASC`,
      [classId, academicSessionId],
    );
  }

  /** merit list-এ নেই এমন enrolled student (FIFO — admission_date, created_at ক্রমে)। */
  getNewStudents(
    classId: string,
    academicSessionId: string,
    excludeIds: string[],
  ): Promise<NewStudentRow[]> {
    return this.em.query(
      `SELECT se.student_id,
              se.admission_date,
              se.created_at AS enrollment_created_at
         FROM public.student_enrollments se
        WHERE se.class_id = $1 AND se.academic_session_id = $2
          AND se.deleted_at IS NULL
          AND se.student_id <> ALL($3::uuid[])
        ORDER BY se.admission_date ASC NULLS LAST, se.created_at ASC`,
      [classId, academicSessionId, excludeIds],
    );
  }

  /** নির্দিষ্ট student-দের ADMISSION exam total (published)। */
  getAdmissionScores(
    classId: string,
    academicSessionId: string,
    studentIds: string[],
  ): Promise<Array<{ student_id: string; admission_score: string }>> {
    if (studentIds.length === 0) return Promise.resolve([]);
    return this.em.query(
      `SELECT er.student_id, COALESCE(SUM(er.marks), 0) AS admission_score
         FROM public.exam_results er
         JOIN public.exams e ON e.id = er.exam_id
        WHERE e.class_id = $1 AND e.academic_session_id = $2
          AND e.exam_type = 'ADMISSION' AND e.status = 'PUBLISHED'
          AND er.deleted_at IS NULL AND e.deleted_at IS NULL
          AND er.student_id = ANY($3::uuid[])
        GROUP BY er.student_id`,
      [classId, academicSessionId, studentIds],
    );
  }

  /** ক্লাসের section গুলো (capacity সহ, নাম ক্রমে) — distribution-এর জন্য। */
  getSectionsForClass(classId: string): Promise<SectionRow[]> {
    return this.em.query(
      `SELECT id, name, max_capacity FROM public.sections
        WHERE class_id = $1 AND deleted_at IS NULL
        ORDER BY name ASC`,
      [classId],
    );
  }

  // ── transactional write ops (manager আবশ্যক) ──

  /** advisory lock — একই class+session-এ concurrent generation ঠেকায়। */
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
    const rows: unknown[] = await manager.query(
      `UPDATE public.student_enrollments
          SET roll_number = $1, section_id = $2, updated_at = NOW()
        WHERE student_id = $3 AND academic_session_id = $4 AND deleted_at IS NULL
        RETURNING student_id`,
      [rollNumber, sectionId, studentId, academicSessionId],
    );
    return rows.length > 0;
  }

  async getNextVersion(
    manager: EntityManager,
    classId: string,
    academicSessionId: string,
  ): Promise<number> {
    const rows: Array<{ v: string }> = await manager.query(
      `SELECT COALESCE(MAX(version), 0)::int AS v FROM public.ranking_history
        WHERE class_id = $1 AND academic_session_id = $2`,
      [classId, academicSessionId],
    );
    return Number(rows[0]?.v ?? 0) + 1;
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
    await manager.query(
      `INSERT INTO public.ranking_history
         (academic_session_id, class_id, student_id, total_score,
          rank_position, roll_number, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        row.academicSessionId,
        row.classId,
        row.studentId,
        row.totalScore,
        row.rankPosition,
        row.rollNumber,
        row.version,
      ],
    );
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
    await manager.query(
      `INSERT INTO public.ranking_audit_log
         (action, class_id, academic_session_id, actor_id,
          from_version, to_version, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        data.action,
        data.classId,
        data.academicSessionId,
        data.actorId,
        data.fromVersion ?? null,
        data.toVersion ?? null,
        data.detail ? JSON.stringify(data.detail) : null,
      ],
    );
  }

  // ── read ops ──
  async getLatestVersion(
    classId: string,
    academicSessionId: string,
  ): Promise<number | null> {
    const rows: Array<{ v: number | null }> = await this.em.query(
      `SELECT MAX(version) AS v FROM public.ranking_history
        WHERE class_id = $1 AND academic_session_id = $2`,
      [classId, academicSessionId],
    );
    return rows[0]?.v ?? null;
  }

  getSnapshot(
    classId: string,
    academicSessionId: string,
    version: number,
  ): Promise<unknown[]> {
    return this.em.query(
      `SELECT rh.student_id, rh.total_score, rh.rank_position, rh.roll_number,
              rh.version, rh.generated_at,
              s.student_code, u.full_name AS student_name
         FROM public.ranking_history rh
         JOIN public.students s ON s.id = rh.student_id
         JOIN public.users u ON u.id = s.user_id
        WHERE rh.class_id = $1 AND rh.academic_session_id = $2 AND rh.version = $3
        ORDER BY rh.rank_position ASC`,
      [classId, academicSessionId, version],
    );
  }

  getVersionList(
    classId: string,
    academicSessionId: string,
  ): Promise<unknown[]> {
    return this.em.query(
      `SELECT version,
              COUNT(*)::int AS student_count,
              MAX(generated_at) AS generated_at
         FROM public.ranking_history
        WHERE class_id = $1 AND academic_session_id = $2
        GROUP BY version
        ORDER BY version DESC`,
      [classId, academicSessionId],
    );
  }

  getAuditLog(
    classId: string,
    academicSessionId: string,
  ): Promise<unknown[]> {
    return this.em.query(
      `SELECT * FROM public.ranking_audit_log
        WHERE class_id = $1 AND academic_session_id = $2
        ORDER BY created_at DESC
        LIMIT 100`,
      [classId, academicSessionId],
    );
  }
}
