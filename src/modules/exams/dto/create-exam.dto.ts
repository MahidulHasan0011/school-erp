import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ExamType } from '../entities/exam.entity';

export class CreateExamDto {
  @ApiProperty({ example: 'Midterm Exam 2025' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Class UUID' })
  @IsUUID()
  classId: string;

  @ApiProperty({ description: 'Academic session UUID' })
  @IsUUID()
  academicSessionId: string;

  @ApiPropertyOptional({ example: '2025-06-15' })
  @IsOptional()
  @IsDateString()
  examDate?: string;

  @ApiProperty({ enum: ExamType, default: ExamType.MIDTERM })
  @IsEnum(ExamType)
  examType: ExamType;
}
