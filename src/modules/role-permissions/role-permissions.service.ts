import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PermissionsRepository } from '../permissions/permissions.repository';
import { RolesRepository } from '../roles/roles.repository';
import { AssignBulkDto } from './dto/assign-bulk.dto';
import { AssignRolePermissionDto } from './dto/assign-role-permission.dto';
import { RolePermissionsRepository } from './role-permissions.repository';

@Injectable()
export class RolePermissionsService {
  constructor(
    private readonly rolePermissionsRepository: RolePermissionsRepository,
    private readonly rolesRepository: RolesRepository,
    private readonly permissionsRepository: PermissionsRepository,
  ) {}

  getByRole(roleId: string) {
    return this.rolePermissionsRepository.findByRole(roleId);
  }

  getByPermission(permissionId: string) {
    return this.rolePermissionsRepository.findByPermission(permissionId);
  }

  async assign(dto: AssignRolePermissionDto) {
    await this.ensureRoleExists(dto.roleId);
    await this.ensurePermissionsExist([dto.permissionId]);
    return this.rolePermissionsRepository.assign(dto.roleId, dto.permissionId);
  }

  async assignBulk(dto: AssignBulkDto) {
    await this.ensureRoleExists(dto.roleId);
    const ids = [...new Set(dto.permissionIds)];
    await this.ensurePermissionsExist(ids);
    await this.rolePermissionsRepository.assignBulk(dto.roleId, ids);
    return { message: `${ids.length} permission(s) assigned` };
  }

  async revoke(dto: AssignRolePermissionDto) {
    const revoked = await this.rolePermissionsRepository.revoke(
      dto.roleId,
      dto.permissionId,
    );
    if (!revoked) {
      throw new NotFoundException('Role-permission mapping not found');
    }
    return { message: 'Permission revoked from role' };
  }

  private async ensureRoleExists(roleId: string): Promise<void> {
    const role = await this.rolesRepository.findById(roleId);
    if (!role) {
      throw new NotFoundException('Role not found');
    }
  }

  private async ensurePermissionsExist(ids: string[]): Promise<void> {
    const found = await this.permissionsRepository.findByIds(ids);
    if (found.length !== ids.length) {
      const foundIds = new Set(found.map((p) => p.id));
      const missing = ids.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `Unknown permission id(s): ${missing.join(', ')}`,
      );
    }
  }
}
