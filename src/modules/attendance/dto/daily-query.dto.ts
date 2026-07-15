import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class DailyQueryDto {
  @ApiProperty({ example: '2025-07-15' })
  @IsDateString()
  date: string;
}