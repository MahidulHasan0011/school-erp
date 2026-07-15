import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { StudentAttendanceStatus } from '../entities/student-attendance.entity';

export class MarkStudentRecordDto {
  @ApiProperty({ description: 'Student UUID' })
  @IsUUID()
  studentId: string;

  @ApiProperty({ enum: StudentAttendanceStatus })
  @IsEnum(StudentAttendanceStatus)
  status: StudentAttendanceStatus;
}

export class MarkStudentsDto {
  @ApiProperty({ description: 'Class UUID' })
  @IsUUID()
  classId: string;

  @ApiPropertyOptional({ description: 'Section UUID' })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiProperty({ example: '2025-07-15' })
  @IsDateString()
  date: string;

  @ApiProperty({ type: [MarkStudentRecordDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => MarkStudentRecordDto)
  records: MarkStudentRecordDto[];
}