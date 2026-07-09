import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { Gender } from '../entities/user.entity';

export class CreateUserDto {
  @ApiProperty({ example: 'admin@school.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Mahidul Hasan' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'StrongP@ss1', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ enum: Gender, default: Gender.MALE })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ description: 'Role UUID from the roles table' })
  @IsOptional()
  @IsUUID()
  roleId?: string;
}
