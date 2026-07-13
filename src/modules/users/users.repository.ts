import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { safeSortColumn } from '../../common/utils/order.util';
import {
  applyFilters,
  applyPagination,
  applySearch,
} from '../../common/utils/query-builder.util';
import { QueryUsersDto } from './dto/query-users.dto';
import { User } from './entities/user.entity';

// user.<prop> — QueryBuilder এ safe sort করার জন্য allow-list (SQL injection ঠেকায়)
const SORTABLE_COLUMNS = [
  'fullName',
  'email',
  'isActive',
  'createdAt',
  'updatedAt',
];

/**
 * Encapsulates all persistence logic for User. Services depend on this,
 * never on the raw Repository, so query logic stays in one place.
 */
@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  create(data: Partial<User>): User {
    return this.repo.create(data);
  }

  save(user: User): Promise<User> {
    return this.repo.save(user);
  }

  /**
   * পেজিনেটেড user list — search (name/email) + filter (isActive/roleId/gender)
   * + safe sort সহ। role relation-ও join করা হয় যাতে ক্লায়েন্ট role নাম পায়।
   */
  findPaginated(query: QueryUsersDto): Promise<[User[], number]> {
    const qb = this.repo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role');

    applySearch(qb, 'user', ['fullName', 'email'], query.search);

    applyFilters(qb, 'user', {
      isActive: query.isActive,
      roleId: query.roleId,
      gender: query.gender,
    });

    const sortBy = safeSortColumn(query.sortBy, SORTABLE_COLUMNS, 'createdAt');
    applyPagination(qb, 'user', {
      skip: query.skip,
      limit: query.limit,
      sortBy,
      order: query.order,
    });

    return qb.getManyAndCount();
  }

  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  /** Includes the password column (normally select:false) for auth checks. */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  /** Same as findById but with the password column selected (for change-password). */
  findByIdWithPassword(id: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id })
      .getOne();
  }

  /**
   * user-এর role name + সব permission name লোড করে (JWT-তে embed করার জন্য)।
   * TypeORM relation দিয়ে load: user → role → rolePermissions → permission।
   * সব entity-তে @DeleteDateColumn থাকায় soft-deleted row গুলো নিজে থেকেই বাদ পড়ে।
   */
  async findAccessControl(
    userId: string,
  ): Promise<{ roles: string[]; permissions: string[] }> {
    const user = await this.repo.findOne({
      where: { id: userId },
      relations: { role: { rolePermissions: { permission: true } } },
    });

    if (!user?.role) {
      return { roles: [], permissions: [] };
    }

    const permissions = (user.role.rolePermissions ?? [])
      .map((rp) => rp.permission?.name)
      .filter((name): name is string => Boolean(name));

    return {
      roles: [user.role.name],
      // একই permission একাধিক role-permission row থেকে এলে dedupe
      permissions: [...new Set(permissions)],
    };
  }

  async remove(user: User): Promise<void> {
    await this.repo.remove(user);
  }
}
