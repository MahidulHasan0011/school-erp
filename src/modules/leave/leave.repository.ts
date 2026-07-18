import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { safeSortColumn } from '../../common/utils/order.util';
import {
  applyFilters,
  applyPagination,
} from '../../common/utils/query-builder.util';
import { QueryLeavesDto } from './dto/query-leaves.dto';
import { Leave } from './entities/leave.entity';

const SORTABLE_COLUMNS = ['createdAt', 'startDate', 'endDate', 'status'];

@Injectable()
export class LeaveRepository {
  constructor(
    @InjectRepository(Leave)
    private readonly repo: Repository<Leave>,
  ) {}

  create(data: Partial<Leave>): Leave {
    return this.repo.create(data);
  }

  save(leave: Leave): Promise<Leave> {
    return this.repo.save(leave);
  }

  findById(id: string): Promise<Leave | null> {
    return this.repo.findOne({ where: { id }, relations: { user: true } });
  }

  findPaginated(
    query: QueryLeavesDto,
    recipientId?: string,
  ): Promise<[Leave[], number]> {
    const qb = this.repo
      .createQueryBuilder('leave')
      .leftJoinAndSelect('leave.user', 'user');

    // recipientId দিলে শুধু ওই user-এর (my-leaves), নইলে সবার (admin)
    if (recipientId) {
      qb.where('leave.userId = :recipientId', { recipientId });
    }

    applyFilters(qb, 'leave', {
      status: query.status,
      leaveType: query.leaveType,
      userId: recipientId ? undefined : query.userId,
    });

    const sortBy = safeSortColumn(query.sortBy, SORTABLE_COLUMNS, 'createdAt');
    applyPagination(qb, 'leave', {
      skip: query.skip,
      limit: query.limit,
      sortBy,
      order: query.order,
    });

    return qb.getManyAndCount();
  }

  async remove(leave: Leave): Promise<void> {
    await this.repo.softRemove(leave);
  }
}
