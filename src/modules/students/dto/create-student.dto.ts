import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateStudentDto {
  @ApiProperty({ example: 'STD-2025-0001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  studentCode: string;

  @ApiPropertyOptional({ example: '2010-05-20' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 'Abdul Karim' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  guardianName?: string;

  @ApiPropertyOptional({ example: '01700000000' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  guardianPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Linked user account UUID (optional)' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
