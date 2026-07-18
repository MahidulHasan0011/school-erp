import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { UploadCategory, UploadStatus } from '../entities/upload.entity';

export class QueryUploadsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: UploadCategory })
  @IsOptional()
  @IsEnum(UploadCategory)
  category?: UploadCategory;

  @ApiPropertyOptional({ enum: UploadStatus })
  @IsOptional()
  @IsEnum(UploadStatus)
  status?: UploadStatus;

  @ApiPropertyOptional({ description: 'যিনি upload করেছেন তার UUID' })
  @IsOptional()
  @IsUUID()
  uploadedBy?: string;

  @ApiPropertyOptional({ description: 'related entity type দিয়ে filter' })
  @IsOptional()
  @IsString()
  relatedType?: string;

  @ApiPropertyOptional({ description: 'related entity UUID দিয়ে filter' })
  @IsOptional()
  @IsUUID()
  relatedId?: string;
}
