import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { safeSortColumn } from '../../common/utils/order.util';
import {
  applyFilters,
  applyPagination,
  applySearch,
} from '../../common/utils/query-builder.util';
import { QueryErrorLogsDto } from './dto/query-error-logs.dto';
import { ErrorLog } from './entities/error-log.entity';

const SORTABLE_COLUMNS = ['createdAt', 'statusCode', 'name'];

@Injectable()
export class ErrorLogsRepository {
  constructor(
    @InjectRepository(ErrorLog)
    private readonly repo: Repository<ErrorLog>,
  ) {}

  findById(id: string): Promise<ErrorLog | null> {
    return this.repo.findOne({ where: { id }, relations: { user: true } });
  }

  findPaginated(query: QueryErrorLogsDto): Promise<[ErrorLog[], number]> {
    const qb = this.repo.createQueryBuilder('errorLog');

    applySearch(qb, 'errorLog', ['name', 'message', 'path'], query.search);
    applyFilters(qb, 'errorLog', {
      statusCode: query.statusCode,
      isOperational: query.isOperational,
      method: query.method,
      userId: query.userId,
    });

    const sortBy = safeSortColumn(query.sortBy, SORTABLE_COLUMNS, 'createdAt');
    applyPagination(qb, 'errorLog', {
      skip: query.skip,
      limit: query.limit,
      sortBy,
      order: query.order,
    });

    return qb.getManyAndCount();
  }

  async remove(log: ErrorLog): Promise<void> {
    await this.repo.softRemove(log);
  }

  /** এখনো soft-delete হয়নি এমন সব log মুছে ফেলে; কতগুলো মোছা হলো তা ফেরত দেয়। */
  async clearAll(): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .softDelete()
      .where('deleted_at IS NULL')
      .execute();
    return result.affected ?? 0;
  }
}
