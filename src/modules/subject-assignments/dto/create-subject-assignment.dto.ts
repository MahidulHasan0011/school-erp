import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class CreateSubjectAssignmentDto {
  @ApiProperty({ description: 'Teacher UUID' })
  @IsUUID()
  teacherId: string;

  @ApiProperty({ description: 'Class UUID' })
  @IsUUID()
  classId: string;

  @ApiPropertyOptional({ description: 'Section UUID' })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiProperty({ description: 'Subject UUID' })
  @IsUUID()
  subjectId: string;

  @ApiProperty({ description: 'Academic session UUID' })
  @IsUUID()
  academicSessionId: string;
}
