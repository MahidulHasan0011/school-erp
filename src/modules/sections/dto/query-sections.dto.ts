import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QuerySectionsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by parent class UUID' })
  @IsOptional()
  @IsUUID()
  classId?: string;
}
