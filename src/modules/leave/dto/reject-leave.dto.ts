import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RejectLeaveDto {
  @ApiPropertyOptional({ description: 'reject করার কারণ (ঐচ্ছিক)' })
  @IsOptional()
  @IsString()
  note?: string;
}
