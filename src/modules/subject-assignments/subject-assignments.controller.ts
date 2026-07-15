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
import { CreateSubjectAssignmentDto } from './dto/create-subject-assignment.dto';
import { QuerySubjectAssignmentsDto } from './dto/query-subject-assignments.dto';
import { UpdateSubjectAssignmentDto } from './dto/update-subject-assignment.dto';
import { SubjectAssignmentsService } from './subject-assignments.service';

@ApiTags('subject-assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('subject-assignments')
export class SubjectAssignmentsController {
  constructor(
    private readonly assignmentsService: SubjectAssignmentsService,
  ) {}

  @Get()
  @Permissions('SUBJECT_ASSIGNMENT_READ')
  @ApiOperation({ summary: 'সব assignment (paginated + filter)' })
  findAll(@Query() query: QuerySubjectAssignmentsDto) {
    return this.assignmentsService.findAll(query);
  }

  // ⚠️ '/teacher/:teacherId' অবশ্যই '/:id'-এর আগে
  @Get('teacher/:teacherId')
  @Permissions('SUBJECT_ASSIGNMENT_READ')
  @ApiOperation({ summary: 'একটি teacher-এর সব assignment' })
  findByTeacher(@Param('teacherId', ParseUUIDPipe) teacherId: string) {
    return this.assignmentsService.findByTeacher(teacherId);
  }

  @Get(':id')
  @Permissions('SUBJECT_ASSIGNMENT_READ')
  @ApiOperation({ summary: 'একটি assignment' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assignmentsService.findOne(id);
  }

  @Post()
  @Permissions('SUBJECT_ASSIGNMENT_CREATE')
  @ApiOperation({ summary: 'নতুন assignment তৈরি' })
  create(
    @Body() dto: CreateSubjectAssignmentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.assignmentsService.create(dto, userId);
  }

  @Patch(':id')
  @Permissions('SUBJECT_ASSIGNMENT_UPDATE')
  @ApiOperation({ summary: 'assignment আপডেট' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubjectAssignmentDto,
  ) {
    return this.assignmentsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('SUBJECT_ASSIGNMENT_DELETE')
  @ApiOperation({ summary: 'assignment মুছে ফেলা' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.assignmentsService.remove(id);
  }
}
