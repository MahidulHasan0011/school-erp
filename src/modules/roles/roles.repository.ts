import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { safeSortColumn } from '../../common/utils/order.util';
import {
  applyPagination,
  applySearch,
} from '../../common/utils/query-builder.util';
import { RolePermission } from '../role-permissions/entities/role-permission.entity';
import { Role } from './entities/role.entity';

const SORTABLE_COLUMNS = ['name', 'createdAt', 'updatedAt'];

@Injectable()
export class RolesRepository {
  constructor(
    @InjectRepository(Role)
    private readonly repo: Repository<Role>,
  ) {}

  create(data: Partial<Role>): Role {
    return this.repo.create(data);
  }

  save(role: Role): Promise<Role> {
    return this.repo.save(role);
  }

  findById(id: string): Promise<Role | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByName(name: string): Promise<Role | null> {
    return this.repo.findOne({ where: { name } });
  }

  /** role + তার সব permission (join) — detail view-এর জন্য। */
  findByIdWithPermissions(id: string): Promise<Role | null> {
    return this.repo.findOne({
      where: { id },
      relations: { rolePermissions: { permission: true } },
    });
  }

  findPaginated(query: PaginationDto): Promise<[Role[], number]> {
    const qb = this.repo.createQueryBuilder('role');

    applySearch(qb, 'role', ['name'], query.search);

    const sortBy = safeSortColumn(query.sortBy, SORTABLE_COLUMNS, 'name');
    applyPagination(qb, 'role', {
      skip: query.skip,
      limit: query.limit,
      sortBy,
      order: query.order,
    });

    return qb.getManyAndCount();
  }

  async remove(role: Role): Promise<void> {
    await this.repo.softRemove(role);
  }

  /**
   * role-এর permission set সম্পূর্ণ replace করে (transaction-এ)।
   * পুরনো row গুলো hard-delete করে নতুন করে insert — unique constraint
   * (role_id, permission_id) soft-delete honor করে না, তাই hard delete।
   */
  async syncPermissions(roleId: string, permissionIds: string[]): Promise<void> {
    await this.repo.manager.transaction(async (em) => {
      await em.delete(RolePermission, { roleId });
      if (permissionIds.length > 0) {
        const rows = permissionIds.map((permissionId) =>
          em.create(RolePermission, { roleId, permissionId }),
        );
        await em.save(rows);
      }
    });
  }
}
