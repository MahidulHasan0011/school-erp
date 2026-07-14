import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateTeacherDto {
  @ApiProperty({ description: 'Linked user account UUID (unique)' })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ example: '01700000000' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'Senior Teacher' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  designation?: string;

  @ApiPropertyOptional({ example: 'M.Sc in Mathematics' })
  @IsOptional()
  @IsString()
  qualification?: string;

  @ApiPropertyOptional({ example: '2025-01-15' })
  @IsOptional()
  @IsDateString()
  joiningDate?: string;
}
