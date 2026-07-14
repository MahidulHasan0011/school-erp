import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSectionDto {
  @ApiProperty({ description: 'Parent class UUID' })
  @IsUUID()
  classId: string;

  @ApiProperty({ example: 'A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  name: string;

  @ApiPropertyOptional({ example: 40, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxCapacity?: number;
}
