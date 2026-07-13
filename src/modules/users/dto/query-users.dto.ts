import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { Gender } from '../entities/user.entity';

/**
 * Query params for GET /users — pagination/search/sort (inherited) plus
 * user-specific filters. Undefined filters are ignored downstream.
 */
export class QueryUsersDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by active state' })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === 'true' || value === true,
  )
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter by role UUID' })
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiPropertyOptional({ enum: Gender, description: 'Filter by gender' })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;
}
