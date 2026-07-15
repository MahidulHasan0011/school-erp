import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceController } from './attendance.controller';
import { AttendanceRepository } from './attendance.repository';
import { AttendanceService } from './attendance.service';
import { AttendanceLog } from './entities/attendance-log.entity';
import { StudentAttendance } from './entities/student-attendance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StudentAttendance, AttendanceLog])],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceRepository],
  exports: [AttendanceService, AttendanceRepository],
})
export class AttendanceModule {}
