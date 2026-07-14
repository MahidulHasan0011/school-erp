import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionsModule } from '../permissions/permissions.module';
import { RolesModule } from '../roles/roles.module';
import { RolePermission } from './entities/role-permission.entity';
import { RolePermissionsController } from './role-permissions.controller';
import { RolePermissionsRepository } from './role-permissions.repository';
import { RolePermissionsService } from './role-permissions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RolePermission]),
    RolesModule,
    PermissionsModule,
  ],
  controllers: [RolePermissionsController],
  providers: [RolePermissionsService, RolePermissionsRepository],
  exports: [RolePermissionsService, RolePermissionsRepository],
})
export class RolePermissionsModule {}
