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
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentsService } from './students.service';

@ApiTags('students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @Permissions('STUDENT_READ')
  @ApiOperation({ summary: 'সব student (paginated)' })
  findAll(@Query() query: PaginationDto) {
    return this.studentsService.findAll(query);
  }

  @Get(':id')
  @Permissions('STUDENT_READ')
  @ApiOperation({ summary: 'একটি student' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.findOne(id);
  }

  @Get(':id/enrollment')
  @Permissions('STUDENT_READ')
  @ApiOperation({ summary: 'student + তার enrollment গুলো' })
  findWithEnrollment(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.findWithEnrollment(id);
  }

  @Post()
  @Permissions('STUDENT_CREATE')
  @ApiOperation({ summary: 'নতুন student তৈরি' })
  create(@Body() dto: CreateStudentDto) {
    return this.studentsService.create(dto);
  }

  @Patch(':id')
  @Permissions('STUDENT_UPDATE')
  @ApiOperation({ summary: 'student আপডেট' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStudentDto) {
    return this.studentsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('STUDENT_DELETE')
  @ApiOperation({ summary: 'student মুছে ফেলা' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.remove(id);
  }
}
