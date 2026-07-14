import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { safeSortColumn } from '../../common/utils/order.util';
import {
  applyFilters,
  applyPagination,
} from '../../common/utils/query-builder.util';
import { AcademicSession } from '../academic-sessions/entities/academic-session.entity';
import { ClassEntity } from '../classes/entities/class.entity';
import { Section } from '../sections/entities/section.entity';
import { QueryEnrollmentsDto } from './dto/query-enrollments.dto';
import { StudentEnrollment } from './entities/student-enrollment.entity';

const SORTABLE_COLUMNS = ['rollNumber', 'admissionDate', 'createdAt', 'updatedAt'];

@Injectable()
export class StudentEnrollmentsRepository {
  constructor(
    @InjectRepository(StudentEnrollment)
    private readonly repo: Repository<StudentEnrollment>,
  ) {}

  create(data: Partial<StudentEnrollment>): StudentEnrollment {
    return this.repo.create(data);
  }

  save(enrollment: StudentEnrollment): Promise<StudentEnrollment> {
    return this.repo.save(enrollment);
  }

  private relations = {
    student: true,
    class: true,
    section: true,
    academicSession: true,
  } as const;

  findById(id: string): Promise<StudentEnrollment | null> {
    return this.repo.findOne({ where: { id }, relations: this.relations });
  }

  /** একই student + session-এ আগে থেকে enrollment আছে কিনা (unique constraint)। */
  findByStudentAndSession(
    studentId: string,
    academicSessionId: string,
  ): Promise<StudentEnrollment | null> {
    return this.repo.findOne({
      where: { studentId, academicSessionId },
    });
  }

  findPaginated(
    query: QueryEnrollmentsDto,
  ): Promise<[StudentEnrollment[], number]> {
    const qb = this.repo
      .createQueryBuilder('enrollment')
      .leftJoinAndSelect('enrollment.student', 'student')
      .leftJoinAndSelect('enrollment.class', 'class')
      .leftJoinAndSelect('enrollment.section', 'section')
      .leftJoinAndSelect('enrollment.academicSession', 'academicSession');

    applyFilters(qb, 'enrollment', {
      studentId: query.studentId,
      classId: query.classId,
      sectionId: query.sectionId,
      academicSessionId: query.academicSessionId,
      enrollmentType: query.enrollmentType,
    });

    const sortBy = safeSortColumn(query.sortBy, SORTABLE_COLUMNS, 'createdAt');
    applyPagination(qb, 'enrollment', {
      skip: query.skip,
      limit: query.limit,
      sortBy,
      order: query.order,
    });

    return qb.getManyAndCount();
  }

  async remove(enrollment: StudentEnrollment): Promise<void> {
    await this.repo.softRemove(enrollment);
  }

  // ── FK existence checks (অন্য টেবিলে সরাসরি service নেই, তাই এখানেই যাচাই) ──
  classExists(id: string): Promise<boolean> {
    return this.exists(ClassEntity, id);
  }

  sectionExists(id: string): Promise<boolean> {
    return this.exists(Section, id);
  }

  sessionExists(id: string): Promise<boolean> {
    return this.exists(AcademicSession, id);
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
