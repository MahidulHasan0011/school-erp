import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { safeSortColumn } from '../../common/utils/order.util';
import { applySearch, applyPagination } from '../../common/utils/query-builder.util';
import { AcademicSession } from './entities/academic-session.entity';

const SORTABLE_COLUMNS = [
  'name',
  'startDate',
  'endDate',
  'createdAt',
  'updatedAt',
];

@Injectable()
export class AcademicSessionsRepository {
  constructor(
    @InjectRepository(AcademicSession)
    private readonly repo: Repository<AcademicSession>,
  ) {}

  create(data: Partial<AcademicSession>): AcademicSession {
    return this.repo.create(data);
  }

  save(session: AcademicSession): Promise<AcademicSession> {
    return this.repo.save(session);
  }

  findById(id: string): Promise<AcademicSession | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByName(name: string): Promise<AcademicSession | null> {
    return this.repo.findOne({ where: { name } });
  }

  findActive(): Promise<AcademicSession | null> {
    return this.repo.findOne({ where: { isActive: true } });
  }

  findPaginated(query: PaginationDto): Promise<[AcademicSession[], number]> {
    const qb = this.repo.createQueryBuilder('session');

    applySearch(qb, 'session', ['name'], query.search);

    const sortBy = safeSortColumn(query.sortBy, SORTABLE_COLUMNS, 'startDate');
    applyPagination(qb, 'session', {
      skip: query.skip,
      limit: query.limit,
      sortBy,
      order: query.order,
    });

    return qb.getManyAndCount();
  }

  /**
   * এই session-কে active করে, বাকি সবগুলোকে inactive — এক সময়ে একটাই
   * active session (transaction-এ)।
   */
  async setActive(id: string): Promise<void> {
    await this.repo.manager.transaction(async (em) => {
      await em.update(AcademicSession, { id: Not(id) }, { isActive: false });
      await em.update(AcademicSession, { id }, { isActive: true });
    });
  }

  async remove(session: AcademicSession): Promise<void> {
    await this.repo.softRemove(session);
  }
}
