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
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { TeachersService } from './teachers.service';

@ApiTags('teachers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Get()
  @Permissions('TEACHER_READ')
  @ApiOperation({ summary: 'সব teacher (paginated)' })
  findAll(@Query() query: PaginationDto) {
    return this.teachersService.findAll(query);
  }

  @Get(':id')
  @Permissions('TEACHER_READ')
  @ApiOperation({ summary: 'একটি teacher' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.teachersService.findOne(id);
  }

  @Get(':id/assignments')
  @Permissions('TEACHER_READ')
  @ApiOperation({ summary: 'teacher + তার subject assignment গুলো' })
  findWithAssignments(@Param('id', ParseUUIDPipe) id: string) {
    return this.teachersService.findWithAssignments(id);
  }

  @Post()
  @Permissions('TEACHER_CREATE')
  @ApiOperation({ summary: 'নতুন teacher profile তৈরি' })
  create(@Body() dto: CreateTeacherDto) {
    return this.teachersService.create(dto);
  }

  @Patch(':id')
  @Permissions('TEACHER_UPDATE')
  @ApiOperation({ summary: 'teacher আপডেট' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeacherDto,
  ) {
    return this.teachersService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('TEACHER_DELETE')
  @ApiOperation({ summary: 'teacher মুছে ফেলা' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.teachersService.remove(id);
  }
}
