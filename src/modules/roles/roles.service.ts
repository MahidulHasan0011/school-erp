import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { PermissionsRepository } from '../permissions/permissions.repository';
import { CreateRoleDto } from './dto/create-role.dto';
import { SyncPermissionsDto } from './dto/sync-permissions.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role } from './entities/role.entity';
import { RolesRepository } from './roles.repository';

@Injectable()
export class RolesService {
  constructor(
    private readonly rolesRepository: RolesRepository,
    private readonly permissionsRepository: PermissionsRepository,
  ) {}

  async create(dto: CreateRoleDto): Promise<Role> {
    const existing = await this.rolesRepository.findByName(dto.name);
    if (existing) {
      throw new ConflictException('Role name already exists');
    }
    const role = this.rolesRepository.create(dto);
    return this.rolesRepository.save(role);
  }

  async findAll(query: PaginationDto) {
    const [data, total] = await this.rolesRepository.findPaginated(query);
    return paginate(data, total, query.page, query.limit);
  }

  /** role detail — permission নামগুলো flatten করে ফেরত দেয়। */
  async findOne(id: string) {
    const role = await this.rolesRepository.findByIdWithPermissions(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    const permissions = (role.rolePermissions ?? [])
      .map((rp) => rp.permission?.name)
      .filter((name): name is string => Boolean(name));

    const { rolePermissions, ...rest } = role;
    return { ...rest, permissions };
  }

  async update(id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.rolesRepository.findById(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (dto.name && dto.name !== role.name) {
      const clash = await this.rolesRepository.findByName(dto.name);
      if (clash) {
        throw new ConflictException('Role name already exists');
      }
    }
    Object.assign(role, dto);
    return this.rolesRepository.save(role);
  }

  async remove(id: string): Promise<{ message: string }> {
    const role = await this.rolesRepository.findById(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    await this.rolesRepository.remove(role);
    return { message: 'Role deleted successfully' };
  }

  /** role-এর permission set সম্পূর্ণ replace করে। */
  async syncPermissions(id: string, dto: SyncPermissionsDto) {
    const role = await this.rolesRepository.findById(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const ids = [...new Set(dto.permissionIds)];
    if (ids.length > 0) {
      // সব permissionId আসলেই DB-তে আছে কিনা যাচাই — না থাকলে reject
      const found = await this.permissionsRepository.findByIds(ids);
      if (found.length !== ids.length) {
        const foundIds = new Set(found.map((p) => p.id));
        const missing = ids.filter((pid) => !foundIds.has(pid));
        throw new BadRequestException(
          `Unknown permission id(s): ${missing.join(', ')}`,
        );
      }
    }

    await this.rolesRepository.syncPermissions(id, ids);
    return this.findOne(id);
  }
}
