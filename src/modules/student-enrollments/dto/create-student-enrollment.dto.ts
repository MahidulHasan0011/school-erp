import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { EnrollmentType } from '../entities/student-enrollment.entity';

export class CreateStudentEnrollmentDto {
  @ApiProperty({ description: 'Student UUID' })
  @IsUUID()
  studentId: string;

  @ApiProperty({ description: 'Class UUID' })
  @IsUUID()
  classId: string;

  @ApiPropertyOptional({ description: 'Section UUID' })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiProperty({ description: 'Academic session UUID' })
  @IsUUID()
  academicSessionId: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  rollNumber?: number;

  @ApiPropertyOptional({ example: '2025-01-15' })
  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @ApiPropertyOptional({ enum: EnrollmentType, default: EnrollmentType.OLD })
  @IsOptional()
  @IsEnum(EnrollmentType)
  enrollmentType?: EnrollmentType;
}
