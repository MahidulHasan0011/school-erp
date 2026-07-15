import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { paginate } from '../../common/utils/pagination.util';
import { AttendanceRepository } from './attendance.repository';
import { DailyQueryDto } from './dto/daily-query.dto';
import { MarkStudentsDto } from './dto/mark-students.dto';
import { MonthQueryDto } from './dto/month-query.dto';
import { QueryStudentAttendanceDto } from './dto/query-student-attendance.dto';
import { StaffAttendanceDto } from './dto/staff-attendance.dto';
import { AttendanceLog } from './entities/attendance-log.entity';
import { StudentAttendance } from './entities/student-attendance.entity';

/** 'YYYY-MM-DD' আকারে মাসের শুরু ও শেষ তারিখ। */
function monthRange(
  year: number,
  month: number,
): { start: string; end: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class AttendanceService {
  constructor(private readonly attendanceRepository: AttendanceRepository) {}

  // ── Student attendance ──

  markStudents(dto: MarkStudentsDto): Promise<StudentAttendance[]> {
    return this.attendanceRepository.upsertStudentRecords(
      dto.classId,
      dto.sectionId,
      dto.date,
      dto.records,
    );
  }

  async listStudents(query: QueryStudentAttendanceDto) {
    const [data, total] =
      await this.attendanceRepository.findStudentPaginated(query);
    return paginate(data, total, query.page, query.limit);
  }

  async studentMonthly(studentId: string, q: MonthQueryDto) {
    const { start, end } = monthRange(q.year, q.month);
    const records = await this.attendanceRepository.findStudentBetween(
      studentId,
      start,
      end,
    );
    return {
      studentId,
      year: q.year,
      month: q.month,
      summary: this.summarizeStudent(records),
      records,
    };
  }

  /**
   * class+section-এর মাসিক attendance — প্রতিটি student আলাদাভাবে তার
   * present/absent/late/excused সংখ্যা সহ। (কে কত দিন উপস্থিত ছিল দেখতে)
   */
  async classMonthly(classId: string, sectionId: string, q: MonthQueryDto) {
    const { start, end } = monthRange(q.year, q.month);
    const records = (await this.attendanceRepository.findClassBetween(
      classId,
      sectionId,
      start,
      end,
    )) as unknown as StudentAttendance[];

    // studentId ধরে group — প্রতিটি student-এর নিজস্ব summary
    const byStudent = new Map<
      string,
      {
        studentId: string;
        studentCode: string | null;
        studentName: string | null;
        summary: {
          PRESENT: number;
          ABSENT: number;
          LATE: number;
          EXCUSED: number;
        };
      }
    >();

    for (const r of records) {
      if (!r.studentId) continue;
      let entry = byStudent.get(r.studentId);
      if (!entry) {
        entry = {
          studentId: r.studentId,
          studentCode: r.student?.studentCode ?? null,
          studentName: r.student?.user?.fullName ?? null,
          summary: { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 },
        };
        byStudent.set(r.studentId, entry);
      }
      if (r.status && r.status in entry.summary) {
        entry.summary[r.status as keyof typeof entry.summary] += 1;
      }
    }

    const students = [...byStudent.values()];
    return {
      classId,
      sectionId,
      year: q.year,
      month: q.month,
      totalStudents: students.length,
      students,
    };
  }

  async dailyClassSummary(
    classId: string,
    sectionId: string,
    q: DailyQueryDto,
  ) {
    const records = await this.attendanceRepository.findClassDaily(
      classId,
      sectionId,
      q.date,
    );
    return {
      classId,
      sectionId,
      date: q.date,
      total: records.length,
      summary: this.summarizeStudent(records),
      records,
    };
  }

  // ── Staff attendance ──

  async staffCheckIn(
    userId: string,
    dto: StaffAttendanceDto,
    ipAddress?: string,
  ): Promise<AttendanceLog> {
    const date = todayStr();
    const existing = await this.attendanceRepository.findLogByUserAndDate(
      userId,
      date,
    );
    if (existing?.checkIn) {
      throw new ConflictException('Already checked in today');
    }

    const log =
      existing ??
      this.attendanceRepository.createLog({ userId, attendanceDate: date });
    log.checkIn = new Date();
    log.status = 'PRESENT';
    log.checkInLatitude = dto.latitude ?? null;
    log.checkInLongitude = dto.longitude ?? null;
    log.ipAddress = ipAddress ?? null;
    if (dto.notes) {
      log.notes = dto.notes;
    }
    return this.attendanceRepository.saveLog(log);
  }

  async staffCheckOut(
    userId: string,
    dto: StaffAttendanceDto,
  ): Promise<AttendanceLog> {
    const date = todayStr();
    const log = await this.attendanceRepository.findLogByUserAndDate(
      userId,
      date,
    );
    if (!log?.checkIn) {
      throw new BadRequestException('You must check in before checking out');
    }
    if (log.checkOut) {
      throw new ConflictException('Already checked out today');
    }

    const now = new Date();
    log.checkOut = now;
    log.totalWorkMinutes = Math.max(
      0,
      Math.round((now.getTime() - log.checkIn.getTime()) / 60000),
    );
    log.checkOutLatitude = dto.latitude ?? null;
    log.checkOutLongitude = dto.longitude ?? null;
    if (dto.notes) {
      log.notes = dto.notes;
    }
    return this.attendanceRepository.saveLog(log);
  }

  async staffMonthly(userId: string, q: MonthQueryDto) {
    const { start, end } = monthRange(q.year, q.month);
    const logs = await this.attendanceRepository.findStaffBetween(
      userId,
      start,
      end,
    );
    const presentDays = logs.filter((l) => l.checkIn).length;
    const totalWorkMinutes = logs.reduce(
      (sum, l) => sum + (l.totalWorkMinutes ?? 0),
      0,
    );
    return {
      userId,
      year: q.year,
      month: q.month,
      summary: {
        totalDays: logs.length,
        presentDays,
        totalWorkMinutes,
        totalWorkHours: Math.round((totalWorkMinutes / 60) * 100) / 100,
      },
      logs,
    };
  }

  /** status-ভিত্তিক গণনা (PRESENT/ABSENT/LATE/EXCUSED)। */
  private summarizeStudent(records: StudentAttendance[]) {
    const summary = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const r of records) {
      if (r.status && r.status in summary) {
        summary[r.status as keyof typeof summary] += 1;
      }
    }
    return summary;
  }
}