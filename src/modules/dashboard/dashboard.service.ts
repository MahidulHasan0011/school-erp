import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AcademicSession } from '../academic-sessions/entities/academic-session.entity';
import { StudentAttendance } from '../attendance/entities/student-attendance.entity';
import { ClassEntity } from '../classes/entities/class.entity';
import { ErrorLog } from '../error-logs/entities/error-log.entity';
import { Exam } from '../exams/entities/exam.entity';
import { Leave, LeaveStatus } from '../leave/entities/leave.entity';
import { Section } from '../sections/entities/section.entity';
import { Student } from '../students/entities/student.entity';
import { Subject } from '../subjects/entities/subject.entity';
import { Teacher } from '../teachers/entities/teacher.entity';
import { Upload } from '../uploads/entities/upload.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class DashboardService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** এক ঝলকে overview — counts + pending + today's attendance + recent। */
  async getOverview() {
    const m = this.dataSource.manager;
    const today = new Date().toISOString().slice(0, 10);

    const [
      students,
      teachers,
      classes,
      sections,
      subjects,
      exams,
      users,
      activeSessions,
      pendingLeaves,
      attendanceRows,
      recentUploads,
      recentErrors,
    ] = await Promise.all([
      m.count(Student),
      m.count(Teacher),
      m.count(ClassEntity),
      m.count(Section),
      m.count(Subject),
      m.count(Exam),
      m.count(User),
      m.count(AcademicSession, { where: { isActive: true } }),
      m.count(Leave, { where: { status: LeaveStatus.PENDING } }),
      this.todayAttendance(today),
      m.getRepository(Upload).find({
        order: { createdAt: 'DESC' },
        take: 5,
      }),
      m.getRepository(ErrorLog).find({
        order: { createdAt: 'DESC' },
        take: 5,
      }),
    ]);

    return {
      counts: {
        students,
        teachers,
        classes,
        sections,
        subjects,
        exams,
        users,
        activeSessions,
      },
      pendingLeaves,
      attendanceToday: attendanceRows,
      recentUploads,
      recentErrors,
    };
  }

  /** আজকের student attendance status অনুযায়ী গণনা → { PRESENT, ABSENT, ... }। */
  private async todayAttendance(today: string): Promise<Record<string, number>> {
    const rows = await this.dataSource
      .getRepository(StudentAttendance)
      .createQueryBuilder('a')
      .select('a.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .where('a.attendanceDate = :today', { today })
      .andWhere('a.deletedAt IS NULL')
      .groupBy('a.status')
      .getRawMany<{ status: string | null; count: number }>();

    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status ?? 'UNKNOWN'] = Number(row.count);
      return acc;
    }, {});
  }
}
