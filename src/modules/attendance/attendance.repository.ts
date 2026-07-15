import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { safeSortColumn } from '../../common/utils/order.util';
import {
  applyFilters,
  applyPagination,
} from '../../common/utils/query-builder.util';
import { QueryStudentAttendanceDto } from './dto/query-student-attendance.dto';
import { AttendanceLog } from './entities/attendance-log.entity';
import { StudentAttendance } from './entities/student-attendance.entity';

const STUDENT_SORTABLE = ['attendanceDate', 'createdAt', 'updatedAt'];

@Injectable()
export class AttendanceRepository {
  constructor(
    @InjectRepository(StudentAttendance)
    private readonly studentRepo: Repository<StudentAttendance>,
    @InjectRepository(AttendanceLog)
    private readonly logRepo: Repository<AttendanceLog>,
  ) {}

  // ── Student attendance ──

  /**
   * class+section+date-এর জন্য প্রতিটি record upsert করে (transaction-এ):
   * একই student+date থাকলে status আপডেট, নইলে নতুন insert।
   */
  async upsertStudentRecords(
    classId: string,
    sectionId: string | undefined,
    date: string,
    records: { studentId: string; status: string }[],
  ): Promise<StudentAttendance[]> {
    return this.studentRepo.manager.transaction(async (em) => {
      const saved: StudentAttendance[] = [];
      for (const rec of records) {
        let row = await em.findOne(StudentAttendance, {
          where: { studentId: rec.studentId, attendanceDate: date },
        });
        if (row) {
          row.status = rec.status;
          row.classId = classId;
          row.sectionId = sectionId ?? null;
        } else {
          row = em.create(StudentAttendance, {
            studentId: rec.studentId,
            classId,
            sectionId: sectionId ?? null,
            attendanceDate: date,
            status: rec.status,
          });
        }
        saved.push(await em.save(row));
      }
      return saved;
    });
  }

  findStudentPaginated(
    query: QueryStudentAttendanceDto,
  ): Promise<[StudentAttendance[], number]> {
    const qb = this.studentRepo
      .createQueryBuilder('att')
      .leftJoinAndSelect('att.student', 'student')
      .leftJoinAndSelect('att.class', 'class')
      .leftJoinAndSelect('att.section', 'section');

    applyFilters(qb, 'att', {
      studentId: query.studentId,
      classId: query.classId,
      sectionId: query.sectionId,
      attendanceDate: query.date,
      status: query.status,
    });

    const sortBy = safeSortColumn(query.sortBy, STUDENT_SORTABLE, 'attendanceDate');
    applyPagination(qb, 'att', {
      skip: query.skip,
      limit: query.limit,
      sortBy,
      order: query.order,
    });

    return qb.getManyAndCount();
  }

  findStudentBetween(
    studentId: string,
    start: string,
    end: string,
  ): Promise<StudentAttendance[]> {
    return this.studentRepo.find({
      where: { studentId, attendanceDate: Between(start, end) },
      order: { attendanceDate: 'ASC' },
    });
  }

  findClassDaily(
    classId: string,
    sectionId: string,
    date: string,
  ): Promise<StudentAttendance[]> {
    return this.studentRepo.find({
      where: { classId, sectionId, attendanceDate: date },
      relations: { student: true },
      order: { createdAt: 'ASC' },
    });
  }

  /** class+section-এর একটি মাসের সব record (student info সহ, per-student summary-র জন্য)। */
  findClassBetween(
    classId: string,
    sectionId: string,
    start: string,
    end: string,
  ): Promise<StudentAttendance[]> {
    return this.studentRepo.find({
      where: { classId, sectionId, attendanceDate: Between(start, end) },
      relations: { student: { user: true } },
      order: { attendanceDate: 'ASC' },
    });
  }

  // ── Staff attendance logs ──

  findLogByUserAndDate(
    userId: string,
    date: string,
  ): Promise<AttendanceLog | null> {
    return this.logRepo.findOne({
      where: { userId, attendanceDate: date },
    });
  }

  createLog(data: Partial<AttendanceLog>): AttendanceLog {
    return this.logRepo.create(data);
  }

  saveLog(log: AttendanceLog): Promise<AttendanceLog> {
    return this.logRepo.save(log);
  }

  findStaffBetween(
    userId: string,
    start: string,
    end: string,
  ): Promise<AttendanceLog[]> {
    return this.logRepo.find({
      where: { userId, attendanceDate: Between(start, end) },
      order: { attendanceDate: 'ASC' },
    });
  }
}