import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { QueryLeavesDto } from './dto/query-leaves.dto';
import { RejectLeaveDto } from './dto/reject-leave.dto';
import { UpdateLeaveDto } from './dto/update-leave.dto';
import { LeaveService } from './leave.service';

@ApiTags('leave')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('leaves')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post()
  @Permissions('LEAVE_CREATE')
  @ApiOperation({ summary: 'নিজের ছুটির আবেদন (PENDING)' })
  apply(@Body() dto: CreateLeaveDto, @CurrentUser('id') userId: string) {
    return this.leaveService.apply(dto, userId);
  }

  @Get('me')
  @Permissions('LEAVE_READ')
  @ApiOperation({ summary: 'আমার ছুটির তালিকা (paginated + filter)' })
  findMine(
    @CurrentUser('id') userId: string,
    @Query() query: QueryLeavesDto,
  ) {
    return this.leaveService.findMine(userId, query);
  }

  @Get()
  @Permissions('LEAVE_READ_ALL')
  @ApiOperation({ summary: 'সব ছুটির আবেদন (admin, paginated + filter)' })
  findAll(@Query() query: QueryLeavesDto) {
    return this.leaveService.findAll(query);
  }

  @Get(':id')
  @Permissions('LEAVE_READ')
  @ApiOperation({ summary: 'নিজের একটি ছুটির আবেদন' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.leaveService.findOneOwned(id, userId);
  }

  @Patch(':id')
  @Permissions('LEAVE_UPDATE')
  @ApiOperation({ summary: 'নিজের PENDING ছুটি আপডেট' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeaveDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.leaveService.update(id, dto, userId);
  }

  @Patch(':id/cancel')
  @Permissions('LEAVE_UPDATE')
  @ApiOperation({ summary: 'নিজের PENDING ছুটি বাতিল' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.leaveService.cancel(id, userId);
  }

  @Patch(':id/approve')
  @Permissions('LEAVE_APPROVE')
  @ApiOperation({ summary: 'ছুটি অনুমোদন (owner-কে notify)' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.leaveService.approve(id, userId);
  }

  @Patch(':id/reject')
  @Permissions('LEAVE_APPROVE')
  @ApiOperation({ summary: 'ছুটি প্রত্যাখ্যান (owner-কে notify)' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectLeaveDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.leaveService.reject(id, userId, dto);
  }

  @Delete(':id')
  @Permissions('LEAVE_DELETE')
  @ApiOperation({ summary: 'ছুটি মুছে ফেলা (admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.leaveService.remove(id);
  }
}
