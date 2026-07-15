import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsNumber,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class BulkResultEntryDto {
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

export class BulkCreateExamResultDto {
  @ApiProperty({ description: 'Exam UUID' })
  @IsUUID()
  examId: string;

  @ApiProperty({ type: [BulkResultEntryDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BulkResultEntryDto)
  entries: BulkResultEntryDto[];
}