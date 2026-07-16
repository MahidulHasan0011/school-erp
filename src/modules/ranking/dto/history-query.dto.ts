import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class HistoryQueryDto {
  @ApiPropertyOptional({ description: 'নির্দিষ্ট version-এর snapshot (না দিলে version list)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;
}
