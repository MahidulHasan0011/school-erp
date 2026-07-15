import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { safeSortColumn } from '../../common/utils/order.util';
import {
  applyFilters,
  applyPagination,
} from '../../common/utils/query-builder.util';
import { Student } from '../students/entities/student.entity';
import { Subject } from '../subjects/entities/subject.entity';
import { QueryExamResultsDto } from './dto/query-exam-results.dto';
import { ExamResult } from './entities/exam-result.entity';

const SORTABLE_COLUMNS = ['marks', 'createdAt', 'updatedAt'];

export interface BulkEntry {
  examId: string;
  studentId: string;
  subjectId: string;
  marks: number;
  grade: string;
}

@Injectable()
export class ExamResultsRepository {
  constructor(
    @InjectRepository(ExamResult)
    private readonly repo: Repository<ExamResult>,
  ) {}

  private relations = {
    exam: true,
    student: { user: true },
    subject: true,
  } as const;

  create(data: Partial<ExamResult>): ExamResult {
    return this.repo.create(data);
  }

  save(result: ExamResult): Promise<ExamResult> {
    return this.repo.save(result);
  }

  findById(id: string): Promise<ExamResult | null> {
    return this.repo.findOne({ where: { id }, relations: this.relations });
  }

  findByExamStudentSubject(
    examId: string,
    studentId: string,
    subjectId: string,
  ): Promise<ExamResult | null> {
    return this.repo.findOne({ where: { examId, studentId, subjectId } });
  }

  findByExamId(examId: string): Promise<ExamResult[]> {
    return this.repo.find({
      where: { examId },
      relations: { student: { user: true }, subject: true },
      order: { createdAt: 'ASC' },
    });
  }

  findByExamAndStudent(
    examId: string,
    studentId: string,
  ): Promise<ExamResult[]> {
    return this.repo.find({
      where: { examId, studentId },
      relations: { subject: true },
      order: { createdAt: 'ASC' },
    });
  }

  findPaginated(query: QueryExamResultsDto): Promise<[ExamResult[], number]> {
    const qb = this.repo
      .createQueryBuilder('er')
      .leftJoinAndSelect('er.exam', 'exam')
      .leftJoinAndSelect('er.student', 'student')
      .leftJoinAndSelect('student.user', 'user')
      .leftJoinAndSelect('er.subject', 'subject');

    applyFilters(qb, 'er', {
      examId: query.examId,
      studentId: query.studentId,
      subjectId: query.subjectId,
    });

    const sortBy = safeSortColumn(query.sortBy, SORTABLE_COLUMNS, 'createdAt');
    applyPagination(qb, 'er', {
      skip: query.skip,
      limit: query.limit,
      sortBy,
      order: query.order,
    });

    return qb.getManyAndCount();
  }

  update(id: string, data: { marks: number; grade: string }): Promise<ExamResult> {
    return this.repo.save({ id, ...data } as ExamResult);
  }

  async remove(result: ExamResult): Promise<void> {
    await this.repo.softRemove(result);
  }

  /**
   * একাধিক result একসাথে upsert (transaction-এ, original ON CONFLICT logic হুবহু):
   * (exam,student,subject) থাকলে marks/grade update + deleted_at reset, নইলে insert।
   */
  async bulkUpsert(entries: BulkEntry[]): Promise<ExamResult[]> {
    return this.repo.manager.transaction(async (em) => {
      const results: ExamResult[] = [];
      for (const e of entries) {
        const rows = await em.query(
          `INSERT INTO exam_results (exam_id, student_id, subject_id, marks, grade)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (exam_id, student_id, subject_id)
           DO UPDATE SET marks = EXCLUDED.marks, grade = EXCLUDED.grade,
                          updated_at = NOW(), deleted_at = NULL
           RETURNING *`,
          [e.examId, e.studentId, e.subjectId, e.marks, e.grade],
        );
        results.push(rows[0] as ExamResult);
      }
      return results;
    });
  }

  // ── completion check ──
  async countStudentsWithResults(examId: string): Promise<number> {
    const rows: Array<{ count: string }> = await this.repo.query(
      `SELECT COUNT(DISTINCT student_id)::int AS count
         FROM exam_results
        WHERE exam_id = $1 AND deleted_at IS NULL`,
      [examId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async countEnrolledStudents(
    classId: string,
    academicSessionId: string,
  ): Promise<number> {
    const rows: Array<{ count: string }> = await this.repo.query(
      `SELECT COUNT(*)::int AS count
         FROM student_enrollments
        WHERE class_id = $1 AND academic_session_id = $2 AND deleted_at IS NULL`,
      [classId, academicSessionId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  // ── FK existence ──
  studentExists(id: string): Promise<boolean> {
    return this.exists(Student, id);
  }

  subjectExists(id: string): Promise<boolean> {
    return this.exists(Subject, id);
  }

  private async exists<T extends ObjectLiteral>(
    target: EntityTarget<T>,
    id: string,
  ): Promise<boolean> {
    const count = await this.repo.manager.count(target, {
      where: { id } as never,
    });
    return count > 0;
  }
}