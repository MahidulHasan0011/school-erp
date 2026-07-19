import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryErrorLogsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'HTTP status code দিয়ে filter' })
  @IsOptional()
  @Transform(({ value }: TransformFnParams): number | undefined =>
    value === undefined ? undefined : Number(value),
  )
  @IsInt()
  statusCode?: number;

  @ApiPropertyOptional({ description: 'operational error কিনা' })
  @IsOptional()
  @Transform(({ value }): boolean | undefined =>
    value === undefined ? undefined : value === 'true' || value === true,
  )
  @IsBoolean()
  isOperational?: boolean;

  @ApiPropertyOptional({ description: 'HTTP method দিয়ে filter' })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({ description: 'যে user-এর context-এ error, তার UUID' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
