import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityTarget, IsNull, ObjectLiteral, Repository } from 'typeorm';
import { safeSortColumn } from '../../common/utils/order.util';
import {
  applyFilters,
  applyPagination,
  applySearch,
} from '../../common/utils/query-builder.util';
import { AcademicSession } from '../academic-sessions/entities/academic-session.entity';
import { ClassEntity } from '../classes/entities/class.entity';
import { Section } from '../sections/entities/section.entity';
import { Subject } from '../subjects/entities/subject.entity';
import { Teacher } from '../teachers/entities/teacher.entity';
import { QuerySubjectAssignmentsDto } from './dto/query-subject-assignments.dto';
import { SubjectAssignment } from './entities/subject-assignment.entity';

const SORTABLE_COLUMNS = ['createdAt', 'updatedAt'];

@Injectable()
export class SubjectAssignmentsRepository {
  constructor(
    @InjectRepository(SubjectAssignment)
    private readonly repo: Repository<SubjectAssignment>,
  ) {}

  create(data: Partial<SubjectAssignment>): SubjectAssignment {
    return this.repo.create(data);
  }

  save(assignment: SubjectAssignment): Promise<SubjectAssignment> {
    return this.repo.save(assignment);
  }

  private relations = {
    teacher: { user: true },
    class: true,
    section: true,
    subject: true,
    academicSession: true,
  } as const;

  findById(id: string): Promise<SubjectAssignment | null> {
    return this.repo.findOne({ where: { id }, relations: this.relations });
  }

  findByTeacher(teacherId: string): Promise<SubjectAssignment[]> {
    return this.repo.find({
      where: { teacherId },
      relations: {
        class: true,
        section: true,
        subject: true,
        academicSession: true,
      },
    });
  }

  /** duplicate assignment যাচাই — unique (teacher,class,section,subject,session)। */
  findDuplicate(dto: {
    teacherId: string;
    classId: string;
    sectionId?: string;
    subjectId: string;
    academicSessionId: string;
  }): Promise<SubjectAssignment | null> {
    return this.repo.findOne({
      where: {
        teacherId: dto.teacherId,
        classId: dto.classId,
        // section না দিলে NULL section-এর সাথেই duplicate যাচাই
        sectionId: dto.sectionId ?? IsNull(),
        subjectId: dto.subjectId,
        academicSessionId: dto.academicSessionId,
      },
    });
  }

  findPaginated(
    query: QuerySubjectAssignmentsDto,
  ): Promise<[SubjectAssignment[], number]> {
    const qb = this.repo
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.teacher', 'teacher')
      .leftJoinAndSelect('teacher.user', 'teacherUser')
      .leftJoinAndSelect('assignment.class', 'class')
      .leftJoinAndSelect('assignment.section', 'section')
      .leftJoinAndSelect('assignment.subject', 'subject')
      .leftJoinAndSelect('assignment.academicSession', 'academicSession');

    // teacher-এর নাম/email (user table), subject ও class-এর নাম জুড়ে search
    applySearch(
      qb,
      'assignment',
      [
        'teacherUser.fullName',
        'teacherUser.email',
        'subject.name',
        'class.name',
      ],
      query.search,
    );
    applyFilters(qb, 'assignment', {
      teacherId: query.teacherId,
      classId: query.classId,
      sectionId: query.sectionId,
      subjectId: query.subjectId,
      academicSessionId: query.academicSessionId,
    });

    const sortBy = safeSortColumn(query.sortBy, SORTABLE_COLUMNS, 'createdAt');
    applyPagination(qb, 'assignment', {
      skip: query.skip,
      limit: query.limit,
      sortBy,
      order: query.order,
    });

    return qb.getManyAndCount();
  }

  async remove(assignment: SubjectAssignment): Promise<void> {
    await this.repo.softRemove(assignment);
  }

  // ── FK existence checks ──
  teacherExists(id: string): Promise<boolean> {
    return this.exists(Teacher, id);
  }

  classExists(id: string): Promise<boolean> {
    return this.exists(ClassEntity, id);
  }

  sectionExists(id: string): Promise<boolean> {
    return this.exists(Section, id);
  }

  subjectExists(id: string): Promise<boolean> {
    return this.exists(Subject, id);
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
