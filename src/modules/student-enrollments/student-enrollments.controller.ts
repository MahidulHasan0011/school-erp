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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreateStudentEnrollmentDto } from './dto/create-student-enrollment.dto';
import { QueryEnrollmentsDto } from './dto/query-enrollments.dto';
import { UpdateStudentEnrollmentDto } from './dto/update-student-enrollment.dto';
import { StudentEnrollmentsService } from './student-enrollments.service';

@ApiTags('student-enrollments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('student-enrollments')
export class StudentEnrollmentsController {
  constructor(
    private readonly enrollmentsService: StudentEnrollmentsService,
  ) {}

  @Get()
  @Permissions('ENROLLMENT_READ')
  @ApiOperation({ summary: 'সব enrollment (paginated + filter)' })
  findAll(@Query() query: QueryEnrollmentsDto) {
    return this.enrollmentsService.findAll(query);
  }

  @Get(':id')
  @Permissions('ENROLLMENT_READ')
  @ApiOperation({ summary: 'একটি enrollment' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.enrollmentsService.findOne(id);
  }

  @Post()
  @Permissions('ENROLLMENT_CREATE')
  @ApiOperation({ summary: 'নতুন enrollment তৈরি' })
  create(@Body() dto: CreateStudentEnrollmentDto) {
    return this.enrollmentsService.create(dto);
  }

  @Patch(':id')
  @Permissions('ENROLLMENT_UPDATE')
  @ApiOperation({ summary: 'enrollment আপডেট' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentEnrollmentDto,
  ) {
    return this.enrollmentsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('ENROLLMENT_UPDATE')
  @ApiOperation({ summary: 'enrollment মুছে ফেলা' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.enrollmentsService.remove(id);
  }
}
