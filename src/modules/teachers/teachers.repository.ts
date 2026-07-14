import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { safeSortColumn } from '../../common/utils/order.util';
import {
  applyPagination,
  applySearch,
} from '../../common/utils/query-builder.util';
import { Teacher } from './entities/teacher.entity';

const SORTABLE_COLUMNS = ['designation', 'joiningDate', 'createdAt', 'updatedAt'];

@Injectable()
export class TeachersRepository {
  constructor(
    @InjectRepository(Teacher)
    private readonly repo: Repository<Teacher>,
  ) {}

  create(data: Partial<Teacher>): Teacher {
    return this.repo.create(data);
  }

  save(teacher: Teacher): Promise<Teacher> {
    return this.repo.save(teacher);
  }

  findById(id: string): Promise<Teacher | null> {
    return this.repo.findOne({ where: { id }, relations: { user: true } });
  }

  findByUserId(userId: string): Promise<Teacher | null> {
    return this.repo.findOne({ where: { userId } });
  }

  /** teacher + তার সব subject assignment (class/section/subject/session সহ)। */
  findByIdWithAssignments(id: string): Promise<Teacher | null> {
    return this.repo.findOne({
      where: { id },
      relations: {
        user: true,
        subjectAssignments: {
          class: true,
          section: true,
          subject: true,
          academicSession: true,
        },
      },
    });
  }

  findPaginated(query: PaginationDto): Promise<[Teacher[], number]> {
    const qb = this.repo
      .createQueryBuilder('teacher')
      .leftJoinAndSelect('teacher.user', 'user');

    applySearch(
      qb,
      'teacher',
      ['designation', 'phone', 'user.fullName', 'user.email'],
      query.search,
    );

    const sortBy = safeSortColumn(query.sortBy, SORTABLE_COLUMNS, 'createdAt');
    applyPagination(qb, 'teacher', {
      skip: query.skip,
      limit: query.limit,
      sortBy,
      order: query.order,
    });

    return qb.getManyAndCount();
  }

  async remove(teacher: Teacher): Promise<void> {
    await this.repo.softRemove(teacher);
  }
}
