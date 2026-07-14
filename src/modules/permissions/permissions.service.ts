import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { Permission } from './entities/permission.entity';
import { PermissionsRepository } from './permissions.repository';

@Injectable()
export class PermissionsService {
  constructor(private readonly permissionsRepository: PermissionsRepository) {}

  async create(dto: CreatePermissionDto): Promise<Permission> {
    const existing = await this.permissionsRepository.findByName(dto.name);
    if (existing) {
      throw new ConflictException('Permission name already exists');
    }
    const permission = this.permissionsRepository.create(dto);
    return this.permissionsRepository.save(permission);
  }

  async findAll(query: PaginationDto) {
    const [data, total] = await this.permissionsRepository.findPaginated(query);
    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Permission> {
    const permission = await this.permissionsRepository.findById(id);
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }
    return permission;
  }

  async update(id: string, dto: UpdatePermissionDto): Promise<Permission> {
    const permission = await this.findOne(id);
    if (dto.name && dto.name !== permission.name) {
      const clash = await this.permissionsRepository.findByName(dto.name);
      if (clash) {
        throw new ConflictException('Permission name already exists');
      }
    }
    Object.assign(permission, dto);
    return this.permissionsRepository.save(permission);
  }

  async remove(id: string): Promise<{ message: string }> {
    const permission = await this.findOne(id);
    await this.permissionsRepository.remove(permission);
    return { message: 'Permission deleted successfully' };
  }
}
