import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreateRoleDto } from './dto/create-role.dto';
import { SyncPermissionsDto } from './dto/sync-permissions.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Permissions('ROLE_READ')
  @ApiOperation({ summary: 'সব role (paginated)' })
  findAll(@Query() query: PaginationDto) {
    return this.rolesService.findAll(query);
  }

  @Get(':id')
  @Permissions('ROLE_READ')
  @ApiOperation({ summary: 'একটি role + তার permission গুলো' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.findOne(id);
  }

  @Post()
  @Permissions('ROLE_CREATE')
  @ApiOperation({ summary: 'নতুন role তৈরি' })
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  @Permissions('ROLE_UPDATE')
  @ApiOperation({ summary: 'role আপডেট' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('ROLE_DELETE')
  @ApiOperation({ summary: 'role মুছে ফেলা' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.remove(id);
  }

  @Put(':id/permissions')
  @Permissions('ROLE_UPDATE')
  @ApiOperation({ summary: 'role-এর permission set সম্পূর্ণ replace' })
  syncPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SyncPermissionsDto,
  ) {
    return this.rolesService.syncPermissions(id, dto);
  }
}
