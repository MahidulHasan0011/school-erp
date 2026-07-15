import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryExamResultsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by exam UUID' })
  @IsOptional()
  @IsUUID()
  examId?: string;

  @ApiPropertyOptional({ description: 'Filter by student UUID' })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({ description: 'Filter by subject UUID' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;
}