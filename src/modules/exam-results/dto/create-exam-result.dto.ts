import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID, Max, Min } from 'class-validator';

export class CreateExamResultDto {
  @ApiProperty({ description: 'Exam UUID' })
  @IsUUID()
  examId: string;

  @ApiProperty({ description: 'Student UUID' })
  @IsUUID()
  studentId: string;

  @ApiProperty({ description: 'Subject UUID' })
  @IsUUID()
  subjectId: string;

  @ApiProperty({ example: 85.5, minimum: 0, maximum: 100 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  marks: number;
}