import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { safeSortColumn } from '../../common/utils/order.util';
import {
  applyPagination,
  applySearch,
} from '../../common/utils/query-builder.util';
import { Student } from './entities/student.entity';

const SORTABLE_COLUMNS = [
  'studentCode',
  'dateOfBirth',
  'createdAt',
  'updatedAt',
];

@Injectable()
export class StudentsRepository {
  constructor(
    @InjectRepository(Student)
    private readonly repo: Repository<Student>,
  ) {}

  create(data: Partial<Student>): Student {
    return this.repo.create(data);
  }

  save(student: Student): Promise<Student> {
    return this.repo.save(student);
  }

  findById(id: string): Promise<Student | null> {
    return this.repo.findOne({ where: { id }, relations: { user: true } });
  }

  findByStudentCode(studentCode: string): Promise<Student | null> {
    return this.repo.findOne({ where: { studentCode } });
  }

  /** student + তার সব enrollment (class/section/session সহ)। */
  findByIdWithEnrollment(id: string): Promise<Student | null> {
    return this.repo.findOne({
      where: { id },
      relations: {
        user: true,
        enrollments: {
          class: true,
          section: true,
          academicSession: true,
        },
      },
    });
  }

  findPaginated(query: PaginationDto): Promise<[Student[], number]> {
    const qb = this.repo
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.user', 'user');

    applySearch(
      qb,
      'student',
      ['studentCode', 'guardianName', 'guardianPhone', 'user.fullName'],
      query.search,
    );

    const sortBy = safeSortColumn(query.sortBy, SORTABLE_COLUMNS, 'createdAt');
    applyPagination(qb, 'student', {
      skip: query.skip,
      limit: query.limit,
      sortBy,
      order: query.order,
    });

    return qb.getManyAndCount();
  }

  async remove(student: Student): Promise<void> {
    await this.repo.softRemove(student);
  }
}
