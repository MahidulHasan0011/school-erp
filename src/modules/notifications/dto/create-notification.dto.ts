import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { NotificationType } from '../entities/notification.entity';

export class CreateNotificationDto {
  @ApiProperty({ type: [String], description: 'যাদের পাঠানো হবে তাদের UUID list' })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  recipientIds: string[];

  @ApiPropertyOptional({ enum: NotificationType, default: NotificationType.GENERAL })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiProperty({ example: 'পরীক্ষার সময়সূচি প্রকাশিত' })
  @IsString()
  @MaxLength(150)
  title: string;

  @ApiProperty({ example: 'আগামী সোমবার থেকে মিডটার্ম শুরু।' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'সম্পর্কিত entity type (exam ইত্যাদি)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  relatedType?: string;

  @ApiPropertyOptional({ description: 'সম্পর্কিত entity UUID' })
  @IsOptional()
  @IsUUID()
  relatedId?: string;
}
