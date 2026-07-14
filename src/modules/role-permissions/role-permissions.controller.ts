import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AssignBulkDto } from './dto/assign-bulk.dto';
import { AssignRolePermissionDto } from './dto/assign-role-permission.dto';
import { RolePermissionsService } from './role-permissions.service';

@ApiTags('role-permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('role-permissions')
export class RolePermissionsController {
  constructor(
    private readonly rolePermissionsService: RolePermissionsService,
  ) {}

  @Get('role/:roleId')
  @Permissions('ROLE_READ')
  @ApiOperation({ summary: 'একটি role-এর সব permission mapping' })
  getByRole(@Param('roleId', ParseUUIDPipe) roleId: string) {
    return this.rolePermissionsService.getByRole(roleId);
  }

  @Get('permission/:permissionId')
  @Permissions('ROLE_READ')
  @ApiOperation({ summary: 'একটি permission যেসব role-এ আছে' })
  getByPermission(@Param('permissionId', ParseUUIDPipe) permissionId: string) {
    return this.rolePermissionsService.getByPermission(permissionId);
  }

  @Post()
  @Permissions('ROLE_UPDATE')
  @ApiOperation({ summary: 'role-এ একটি permission assign' })
  assign(@Body() dto: AssignRolePermissionDto) {
    return this.rolePermissionsService.assign(dto);
  }

  @Post('bulk')
  @Permissions('ROLE_UPDATE')
  @ApiOperation({ summary: 'role-এ একাধিক permission assign' })
  assignBulk(@Body() dto: AssignBulkDto) {
    return this.rolePermissionsService.assignBulk(dto);
  }

  @Delete()
  @Permissions('ROLE_UPDATE')
  @ApiOperation({ summary: 'role থেকে একটি permission revoke' })
  revoke(@Body() dto: AssignRolePermissionDto) {
    return this.rolePermissionsService.revoke(dto);
  }
}
