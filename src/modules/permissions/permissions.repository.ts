import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { safeSortColumn } from '../../common/utils/order.util';
import {
  applyPagination,
  applySearch,
} from '../../common/utils/query-builder.util';
import { Permission } from './entities/permission.entity';

const SORTABLE_COLUMNS = ['name', 'createdAt', 'updatedAt'];

@Injectable()
export class PermissionsRepository {
  constructor(
    @InjectRepository(Permission)
    private readonly repo: Repository<Permission>,
  ) {}

  create(data: Partial<Permission>): Permission {
    return this.repo.create(data);
  }

  save(permission: Permission): Promise<Permission> {
    return this.repo.save(permission);
  }

  findById(id: string): Promise<Permission | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByName(name: string): Promise<Permission | null> {
    return this.repo.findOne({ where: { name } });
  }

  /** দেওয়া id গুলোর মধ্যে যেগুলো আসলে আছে (soft-deleted বাদে) সেগুলো ফেরত দেয়। */
  findByIds(ids: string[]): Promise<Permission[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.repo.find({ where: { id: In(ids) } });
  }

  findPaginated(query: PaginationDto): Promise<[Permission[], number]> {
    const qb = this.repo.createQueryBuilder('permission');

    applySearch(qb, 'permission', ['name'], query.search);

    const sortBy = safeSortColumn(query.sortBy, SORTABLE_COLUMNS, 'name');
    applyPagination(qb, 'permission', {
      skip: query.skip,
      limit: query.limit,
      sortBy,
      order: query.order,
    });

    return qb.getManyAndCount();
  }

  async remove(permission: Permission): Promise<void> {
    await this.repo.softRemove(permission);
  }
}
