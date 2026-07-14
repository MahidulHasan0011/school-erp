import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { safeSortColumn } from '../../common/utils/order.util';
import {
  applySearch,
  applyPagination,
} from '../../common/utils/query-builder.util';
import { Subject } from './entities/subject.entity';

const SORTABLE_COLUMNS = ['name', 'code', 'createdAt', 'updatedAt'];

@Injectable()
export class SubjectsRepository {
  constructor(
    @InjectRepository(Subject)
    private readonly repo: Repository<Subject>,
  ) {}

  create(data: Partial<Subject>): Subject {
    return this.repo.create(data);
  }

  save(subject: Subject): Promise<Subject> {
    return this.repo.save(subject);
  }

  findById(id: string): Promise<Subject | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByCode(code: string): Promise<Subject | null> {
    return this.repo.findOne({ where: { code } });
  }

  findPaginated(query: PaginationDto): Promise<[Subject[], number]> {
    const qb = this.repo.createQueryBuilder('subject');

    applySearch(qb, 'subject', ['name', 'code'], query.search);

    const sortBy = safeSortColumn(query.sortBy, SORTABLE_COLUMNS, 'name');
    applyPagination(qb, 'subject', {
      skip: query.skip,
      limit: query.limit,
      sortBy,
      order: query.order,
    });

    return qb.getManyAndCount();
  }

  async remove(subject: Subject): Promise<void> {
    await this.repo.softRemove(subject);
  }
}
