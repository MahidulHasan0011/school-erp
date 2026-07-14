import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { safeSortColumn } from '../../common/utils/order.util';
import {
  applyFilters,
  applyPagination,
} from '../../common/utils/query-builder.util';
import { StudentEnrollment } from '../student-enrollments/entities/student-enrollment.entity';
import { Section } from './entities/section.entity';

const SORTABLE_COLUMNS = ['name', 'maxCapacity', 'createdAt', 'updatedAt'];

@Injectable()
export class SectionsRepository {
  constructor(
    @InjectRepository(Section)
    private readonly repo: Repository<Section>,
  ) {}

  create(data: Partial<Section>): Section {
    return this.repo.create(data);
  }

  save(section: Section): Promise<Section> {
    return this.repo.save(section);
  }

  findById(id: string): Promise<Section | null> {
    return this.repo.findOne({ where: { id }, relations: { class: true } });
  }

  findPaginated(
    query: PaginationDto & { classId?: string },
  ): Promise<[Section[], number]> {
    const qb = this.repo
      .createQueryBuilder('section')
      .leftJoinAndSelect('section.class', 'class');

    applyFilters(qb, 'section', { classId: query.classId });

    const sortBy = safeSortColumn(query.sortBy, SORTABLE_COLUMNS, 'name');
    applyPagination(qb, 'section', {
      skip: query.skip,
      limit: query.limit,
      sortBy,
      order: query.order,
    });

    return qb.getManyAndCount();
  }

  /** section-এ কতজন student ভর্তি (soft-deleted বাদে)। */
  countEnrollments(sectionId: string): Promise<number> {
    return this.repo.manager.count(StudentEnrollment, {
      where: { sectionId },
    });
  }

  async remove(section: Section): Promise<void> {
    await this.repo.softRemove(section);
  }
}
