import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AttendanceService } from './attendance.service';
import { DailyQueryDto } from './dto/daily-query.dto';
import { MarkStudentsDto } from './dto/mark-students.dto';
import { MonthQueryDto } from './dto/month-query.dto';
import { QueryStudentAttendanceDto } from './dto/query-student-attendance.dto';
import { StaffAttendanceDto } from './dto/staff-attendance.dto';

@ApiTags('attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // ── Student attendance ──

  @Post('students')
  @Permissions('ATTENDANCE_MARK')
  @ApiOperation({ summary: 'ক্লাসের student attendance mark (bulk upsert)' })
  markStudents(@Body() dto: MarkStudentsDto) {
    return this.attendanceService.markStudents(dto);
  }

  @Get('students')
  @Permissions('ATTENDANCE_READ')
  @ApiOperation({ summary: 'student attendance list (paginated + filter)' })
  listStudents(@Query() query: QueryStudentAttendanceDto) {
    return this.attendanceService.listStudents(query);
  }

  @Get('students/:studentId/monthly')
  @Permissions('ATTENDANCE_READ')
  @ApiOperation({ summary: 'একজন student-এর মাসিক attendance + summary' })
  studentMonthly(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Query() query: MonthQueryDto,
  ) {
    return this.attendanceService.studentMonthly(studentId, query);
  }

  @Get('class/:classId/:sectionId/daily')
  @Permissions('ATTENDANCE_READ')
  @ApiOperation({ summary: 'class+section-এর দৈনিক attendance summary' })
  dailyClassSummary(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
    @Query() query: DailyQueryDto,
  ) {
    return this.attendanceService.dailyClassSummary(classId, sectionId, query);
  }

  @Get('class/:classId/:sectionId/monthly')
  @Permissions('ATTENDANCE_READ')
  @ApiOperation({
    summary: 'class+section-এর মাসিক attendance (প্রতি student-এর summary)',
  })
  classMonthly(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
    @Query() query: MonthQueryDto,
  ) {
    return this.attendanceService.classMonthly(classId, sectionId, query);
  }

  // ── Staff attendance ──

  @Post('staff/check-in')
  @Permissions('ATTENDANCE_MARK')
  @ApiOperation({ summary: 'নিজের check-in (আজকের জন্য)' })
  staffCheckIn(
    @CurrentUser('id') userId: string,
    @Body() dto: StaffAttendanceDto,
    @Ip() ip: string,
  ) {
    return this.attendanceService.staffCheckIn(userId, dto, ip);
  }

  @Post('staff/check-out')
  @Permissions('ATTENDANCE_MARK')
  @ApiOperation({ summary: 'নিজের check-out (আজকের জন্য)' })
  staffCheckOut(
    @CurrentUser('id') userId: string,
    @Body() dto: StaffAttendanceDto,
  ) {
    return this.attendanceService.staffCheckOut(userId, dto);
  }

  @Get('staff/:userId/monthly')
  @Permissions('ATTENDANCE_READ')
  @ApiOperation({ summary: 'একজন staff-এর মাসিক attendance + summary' })
  staffMonthly(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: MonthQueryDto,
  ) {
    return this.attendanceService.staffMonthly(userId, query);
  }
}
