import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { UploadCategory } from '../entities/upload.entity';

export class GenerateUrlDto {
  @ApiProperty({ example: 'transcript.pdf' })
  @IsString()
  @MaxLength(255)
  originalName: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @MaxLength(127)
  mimeType: string;

  @ApiProperty({ description: 'ফাইলের আকার (byte)', example: 20480 })
  @IsInt()
  @IsPositive()
  fileSize: number;

  @ApiProperty({ enum: UploadCategory })
  @IsEnum(UploadCategory)
  category: UploadCategory;

  @ApiPropertyOptional({ description: 'file integrity checksum (sha256 ইত্যাদি)' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  checksum?: string;

  @ApiPropertyOptional({ description: 'কোন entity-র সাথে সম্পর্কিত (student ইত্যাদি)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  relatedType?: string;

  @ApiPropertyOptional({ description: 'সম্পর্কিত entity-র UUID' })
  @IsOptional()
  @IsUUID()
  relatedId?: string;

  @ApiPropertyOptional({ description: 'অতিরিক্ত metadata (jsonb)' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
