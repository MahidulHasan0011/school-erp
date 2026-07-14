import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolePermission } from './entities/role-permission.entity';

@Injectable()
export class RolePermissionsRepository {
  constructor(
    @InjectRepository(RolePermission)
    private readonly repo: Repository<RolePermission>,
  ) {}

  /** একটি role-এর সব permission (join সহ)। */
  findByRole(roleId: string): Promise<RolePermission[]> {
    return this.repo.find({
      where: { roleId },
      relations: { permission: true },
    });
  }

  /** একটি permission যেসব role-এ আছে (join সহ)। */
  findByPermission(permissionId: string): Promise<RolePermission[]> {
    return this.repo.find({
      where: { permissionId },
      relations: { role: true },
    });
  }

  /** সফট-ডিলিটসহ pair খোঁজে (restore/duplicate যাচাইয়ের জন্য)। */
  findPair(
    roleId: string,
    permissionId: string,
  ): Promise<RolePermission | null> {
    return this.repo.findOne({
      where: { roleId, permissionId },
      withDeleted: true,
    });
  }

  /**
   * pair assign করে — idempotent:
   * - সক্রিয় থাকলে সেটাই ফেরত
   * - সফট-ডিলিটেড থাকলে restore
   * - না থাকলে নতুন insert
   */
  async assign(roleId: string, permissionId: string): Promise<RolePermission> {
    const existing = await this.findPair(roleId, permissionId);
    if (existing) {
      if (existing.deletedAt) {
        return this.repo.recover(existing);
      }
      return existing;
    }
    return this.repo.save(this.repo.create({ roleId, permissionId }));
  }

  /** একাধিক permission এক role-এ assign করে (transaction-এ, idempotent)। */
  async assignBulk(roleId: string, permissionIds: string[]): Promise<void> {
    await this.repo.manager.transaction(async (em) => {
      for (const permissionId of permissionIds) {
        const existing = await em.findOne(RolePermission, {
          where: { roleId, permissionId },
          withDeleted: true,
        });
        if (existing) {
          if (existing.deletedAt) {
            await em.recover(RolePermission, existing);
          }
        } else {
          await em.save(em.create(RolePermission, { roleId, permissionId }));
        }
      }
    });
  }

  /** pair revoke করে (soft-delete)। true = কিছু revoke হয়েছে। */
  async revoke(roleId: string, permissionId: string): Promise<boolean> {
    const existing = await this.repo.findOne({
      where: { roleId, permissionId },
    });
    if (!existing) {
      return false;
    }
    await this.repo.softRemove(existing);
    return true;
  }
}
