import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EnrollmentType } from '../entities/student-enrollment.entity';

export class QueryEnrollmentsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by student UUID' })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({ description: 'Filter by class UUID' })
  @IsOptional()
  @IsUUID()
  classId?: string;

  @ApiPropertyOptional({ description: 'Filter by section UUID' })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiPropertyOptional({ description: 'Filter by academic session UUID' })
  @IsOptional()
  @IsUUID()
  academicSessionId?: string;

  @ApiPropertyOptional({ enum: EnrollmentType })
  @IsOptional()
  @IsEnum(EnrollmentType)
  enrollmentType?: EnrollmentType;
}
